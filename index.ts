import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { fetchAllContent, type ExtractedContent } from "./extract.js";
import { clearCloneCache } from "./github-extract.js";
import { search } from "./search.js";
import type { SearchResult } from "./types.js";
import {
	clearResults,
	deleteResult,
	generateId,
	getAllResults,
	getResult,
	restoreFromSession,
	storeResult,
	type QueryResultData,
	type StoredSearchData,
} from "./storage.js";
import { activityMonitor, type ActivityEntry } from "./activity.js";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasExaApiKey } from "./exa.js";

const WEB_SEARCH_CONFIG_PATH = join(homedir(), ".pi", "web-search.json");

interface WebSearchConfig {
	shortcuts?: {
		activity?: string;
	};
}

const DEFAULT_SHORTCUTS = { activity: "ctrl+shift+w" };
const MAX_INLINE_CONTENT = 30000;

let widgetVisible = false;
let widgetUnsubscribe: (() => void) | null = null;

function loadConfig(): WebSearchConfig {
	if (!existsSync(WEB_SEARCH_CONFIG_PATH)) return {};
	const raw = readFileSync(WEB_SEARCH_CONFIG_PATH, "utf-8");
	try {
		return JSON.parse(raw) as WebSearchConfig;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to parse ${WEB_SEARCH_CONFIG_PATH}: ${message}`);
	}
}

function loadConfigForExtensionInit(): WebSearchConfig {
	try {
		return loadConfig();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[pi-web-search] ${message}`);
		return {};
	}
}

function formatSearchSummary(results: SearchResult[], answer: string): string {
	let output = answer ? `${answer}\n\n---\n\n**Sources:**\n` : "";
	output += results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`).join("\n\n");
	return output;
}

function formatFullResults(queryData: QueryResultData): string {
	let output = `## Results for: "${queryData.query}"\n\n`;
	if (queryData.answer) {
		output += `${queryData.answer}\n\n---\n\n`;
	}
	for (const r of queryData.results) {
		output += `### ${r.title}\n${r.url}\n\n`;
	}
	return output;
}

function updateWidget(ctx: ExtensionContext): void {
	const theme = ctx.ui.theme;
	const entries = activityMonitor.getEntries();
	const lines: string[] = [];

	lines.push(theme.fg("accent", "─── Web Search Activity " + "─".repeat(36)));

	if (entries.length === 0) {
		lines.push(theme.fg("muted", "  No activity yet"));
	} else {
		for (const e of entries) {
			lines.push("  " + formatEntryLine(e, theme));
		}
	}

	lines.push(theme.fg("accent", "─".repeat(60)));

	const rateInfo = activityMonitor.getRateLimitInfo();
	const resetMs = rateInfo.oldestTimestamp ? Math.max(0, rateInfo.oldestTimestamp + rateInfo.windowMs - Date.now()) : 0;
	const resetSec = Math.ceil(resetMs / 1000);
	lines.push(
		theme.fg("muted", `Rate: ${rateInfo.used}/${rateInfo.max}`) +
			(resetMs > 0 ? theme.fg("dim", ` (resets in ${resetSec}s)`) : ""),
	);

	ctx.ui.setWidget("web-activity", new Text(lines.join("\n"), 0, 0));
}

function formatEntryLine(
	entry: ActivityEntry,
	theme: { fg: (color: string, text: string) => string },
): string {
	const typeStr = entry.type === "api" ? "API" : "GET";
	const target =
		entry.type === "api"
			? `"${truncateToWidth(entry.query || "", 28, "")}"`
			: truncateToWidth(entry.url?.replace(/^https?:\/\//, "") || "", 30, "");

	const duration = entry.endTime
		? `${((entry.endTime - entry.startTime) / 1000).toFixed(1)}s`
		: `${((Date.now() - entry.startTime) / 1000).toFixed(1)}s`;

	let statusStr: string;
	let indicator: string;
	if (entry.error) {
		statusStr = "err";
		indicator = theme.fg("error", "✗");
	} else if (entry.status === null) {
		statusStr = "...";
		indicator = theme.fg("warning", "⋯");
	} else if (entry.status === 0) {
		statusStr = "abort";
		indicator = theme.fg("muted", "○");
	} else {
		statusStr = String(entry.status);
		indicator = entry.status >= 200 && entry.status < 300 ? theme.fg("success", "✓") : theme.fg("error", "✗");
	}

	return `${typeStr.padEnd(4)} ${target.padEnd(32)} ${statusStr.padStart(5)} ${duration.padStart(5)} ${indicator}`;
}

function handleSessionChange(ctx: ExtensionContext): void {
	clearCloneCache();
	restoreFromSession(ctx);
	widgetUnsubscribe?.();
	widgetUnsubscribe = null;
	activityMonitor.clear();
	if (widgetVisible) {
		widgetUnsubscribe = activityMonitor.onUpdate(() => updateWidget(ctx));
		updateWidget(ctx);
	}
}

export default function (pi: ExtensionAPI) {
	const initConfig = loadConfigForExtensionInit();
	const activityKey = initConfig.shortcuts?.activity || DEFAULT_SHORTCUTS.activity;

	if (!hasExaApiKey()) {
		console.log("[pi-web-search] No Exa API key set. Search uses Exa MCP (zero-config). Set EXA_API_KEY for direct API access.");
	}

	pi.registerShortcut(activityKey, {
		description: "Toggle web search activity",
		handler: async (ctx) => {
			widgetVisible = !widgetVisible;
			if (widgetVisible) {
				widgetUnsubscribe = activityMonitor.onUpdate(() => updateWidget(ctx));
				updateWidget(ctx);
			} else {
				widgetUnsubscribe?.();
				widgetUnsubscribe = null;
				ctx.ui.setWidget("web-activity", null);
			}
		},
	});

	pi.on("session_start", async (_event, ctx) => handleSessionChange(ctx));
	pi.on("session_tree", async (_event, ctx) => handleSessionChange(ctx));

	pi.on("session_shutdown", () => {
		clearResults();
		widgetUnsubscribe?.();
		widgetUnsubscribe = null;
		activityMonitor.clear();
		widgetVisible = false;
	});

	pi.registerTool({
		name: "web",
		label: "Web",
		description:
			"Single web tool. Use mode='search' to search by keywords, mode='read' to read one known URL, and mode='get' to retrieve a stored result by resultId.",
		promptSnippet:
			"Use this single tool for all web tasks: search = find sources, read = read a known URL, get = retrieve a stored result.",
		parameters: Type.Object({
			mode: StringEnum(["search", "read", "get"], {
				description: "search = find sources by query; read = read one known URL; get = retrieve a stored result by resultId.",
			}),
			query: Type.Optional(Type.String({ description: "For mode='search': one search query string." })),
			numResults: Type.Optional(Type.Number({ description: "For mode='search': how many results to return (default: 5, max: 20)." })),
			url: Type.Optional(Type.String({ description: "For mode='read': one known URL to read." })),
			forceClone: Type.Optional(Type.Boolean({
				description: "For mode='read' on GitHub repo URLs: force cloning even when the repo exceeds the size threshold.",
			})),
			resultId: Type.Optional(Type.String({ description: "For mode='get': resultId returned by an earlier web call." })),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			if (params.mode === "search") {
				const query = typeof params.query === "string" ? params.query.trim() : "";
				if (!query) {
					return {
						content: [{ type: "text", text: "Error: mode='search' requires query." }],
						details: { mode: "search", error: "No query provided" },
					};
				}

				onUpdate?.({
					content: [{ type: "text", text: `Searching for "${query}"...` }],
					details: { mode: "search", phase: "search", progress: 0, currentQuery: query },
				});

				try {
					const numResults = params.numResults != null ? Math.min(Math.max(1, Math.floor(params.numResults)), 20) : undefined;
					const { answer, results } = await search(query, {
						numResults,
						signal,
					});
					const queryData: QueryResultData = { query, answer, results, error: null };
					const resultId = generateId();
					const searchData: StoredSearchData = {
						id: resultId,
						type: "search",
						timestamp: Date.now(),
						queries: [queryData],
					};
					storeResult(resultId, searchData);
					pi.appendEntry("web-search-results", searchData);

					let output = results.length === 0
						? "No results found."
						: formatSearchSummary(results, answer);
					output += `

---
resultId: ${resultId}`;

					return {
						content: [{ type: "text", text: output.trim() }],
						details: {
							mode: "search",
							query,
							totalResults: results.length,
							resultId,
						},
					};
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return {
						content: [{ type: "text", text: `Error: ${message}` }],
						details: { mode: "search", error: message },
					};
				}
			}

			if (params.mode === "read") {
				const url = typeof params.url === "string" ? params.url.trim() : "";
				if (!url) {
					return {
						content: [{ type: "text", text: "Error: mode='read' requires url." }],
						details: { mode: "read", error: "No URL provided" },
					};
				}

				onUpdate?.({
					content: [{ type: "text", text: `Reading URL: ${url}` }],
					details: { mode: "read", phase: "read", progress: 0 },
				});

				const fetchResults = await fetchAllContent([url], signal, {
					forceClone: params.forceClone,
				});
				const result = fetchResults[0];
				const resultId = generateId();
				const data: StoredSearchData = {
					id: resultId,
					type: "fetch",
					timestamp: Date.now(),
					urls: fetchResults,
				};
				storeResult(resultId, data);
				pi.appendEntry("web-search-results", data);

				if (result.error) {
					return {
						content: [{ type: "text", text: `Error: ${result.error}` }],
						details: { mode: "read", error: result.error, url, resultId },
					};
				}

				const fullLength = result.content.length;
				const truncated = fullLength > MAX_INLINE_CONTENT;
				let output = truncated
					? result.content.slice(0, MAX_INLINE_CONTENT) + "\n\n[Content truncated...]"
					: result.content;
				if (truncated) {
					output += `

---
Showing ${MAX_INLINE_CONTENT} of ${fullLength} chars.`;
				}
				output += `

---
resultId: ${resultId}`;

				return {
					content: [{ type: "text", text: output }],
					details: {
						mode: "read",
						url,
						title: result.title,
						totalChars: fullLength,
						truncated,
						resultId,
					},
				};
			}

			const resultId = typeof params.resultId === "string" ? params.resultId.trim() : "";
			if (!resultId) {
				return {
					content: [{ type: "text", text: "Error: mode='get' requires resultId." }],
					details: { mode: "get", error: "No resultId provided" },
				};
			}

			const data = getResult(resultId);
			if (!data) {
				return {
					content: [{ type: "text", text: `Error: No stored results for "${resultId}"` }],
					details: { mode: "get", error: "Not found", resultId },
				};
			}

			if (data.type === "search" && data.queries) {
				const sections = data.queries.map((queryData, index) => {
					if (queryData.error) {
						return `## Query ${index + 1}: "${queryData.query}"

Error: ${queryData.error}`;
					}
					return data.queries.length > 1
						? `## Query ${index + 1}: "${queryData.query}"

${formatFullResults(queryData)}`
						: formatFullResults(queryData);
				}).join("\n\n");
				const totalResults = data.queries.reduce((sum, q) => sum + q.results.length, 0);
				return {
					content: [{ type: "text", text: sections }],
					details: {
						mode: "get",
						sourceType: "search",
						queryCount: data.queries.length,
						resultCount: totalResults,
						resultId,
					},
				};
			}

			if (data.type === "fetch" && data.urls) {
				const sections = data.urls.map((urlData) => {
					if (urlData.error) {
						return `# ${urlData.title || urlData.url}

Error: ${urlData.error}`;
					}
					return `# ${urlData.title || urlData.url}

${urlData.content}`;
				}).join("\n\n---\n\n");
				const totalChars = data.urls.reduce((sum, u) => sum + u.content.length, 0);
				return {
					content: [{ type: "text", text: sections }],
					details: {
						mode: "get",
						sourceType: "read",
						urlCount: data.urls.length,
						totalChars,
						resultId,
					},
				};
			}

			return {
				content: [{ type: "text", text: "Invalid stored data format" }],
				details: { mode: "get", error: "Invalid data", resultId },
			};
		},

		renderCall(args, theme) {
			const { mode, query, url, resultId } = args as {
				mode?: string;
				query?: string;
				url?: string;
				resultId?: string;
			};
			let target = "";
			if (mode === "search") target = query || "(no query)";
			else if (mode === "read") target = url || "(no URL)";
			else if (mode === "get") target = resultId || "(no resultId)";
			const display = target.length > 60 ? target.slice(0, 57) + "..." : target;
			return new Text(theme.fg("toolTitle", theme.bold("web ")) + theme.fg("accent", `${mode || "?"} ${display}`), 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as {
				mode?: string;
				sourceType?: string;
				query?: string;
				title?: string;
				totalResults?: number;
				resultCount?: number;
				queryCount?: number;
				urlCount?: number;
				totalChars?: number;
				truncated?: boolean;
				resultId?: string;
				error?: string;
				phase?: string;
			};

			if (isPartial) {
				return new Text(theme.fg("accent", details?.phase || "working..."), 0, 0);
			}
			if (details?.error) {
				return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
			}

			let statusLine = theme.fg("success", details?.mode || "web");
			if (details?.mode === "search") {
				statusLine += theme.fg("muted", ` (${details.totalResults ?? 0} sources)`);
			} else if (details?.mode === "read") {
				statusLine += theme.fg("muted", ` (${details.totalChars ?? 0} chars)`);
				if (details?.truncated) statusLine += theme.fg("warning", " [truncated]");
			} else if (details?.mode === "get" && details?.sourceType === "search") {
				statusLine += theme.fg("muted", ` (${details.queryCount ?? 0} queries, ${details.resultCount ?? 0} results)`);
			} else if (details?.mode === "get" && details?.sourceType === "read") {
				statusLine += theme.fg("muted", ` (${details.urlCount ?? 0} URLs, ${details.totalChars ?? 0} chars)`);
			}
			if (details?.resultId) {
				statusLine += theme.fg("dim", ` [${details.resultId.slice(0, 8)}]`);
			}

			if (!expanded) {
				return new Text(statusLine, 0, 0);
			}
			const textContent = result.content.find((c) => c.type === "text")?.text || "";
			const preview = textContent.length > 500 ? textContent.slice(0, 500) + "..." : textContent;
			return new Text(statusLine + "\n" + theme.fg("dim", preview), 0, 0);
		},
	});

	pi.registerCommand("search", {
		description: "Browse stored web results",
		handler: async (_args, ctx) => {
			const results = getAllResults();

			if (results.length === 0) {
				ctx.ui.notify("No stored web results", "info");
				return;
			}

			const options = results.map((r) => {
				const age = Math.floor((Date.now() - r.timestamp) / 60000);
				const ageStr = age < 60 ? `${age}m ago` : `${Math.floor(age / 60)}h ago`;
				if (r.type === "search" && r.queries) {
					const query = r.queries[0]?.query || "unknown";
					return `[${r.id.slice(0, 6)}] "${query}" (${r.queries.length} queries) - ${ageStr}`;
				}
				if (r.type === "fetch" && r.urls) {
					return `[${r.id.slice(0, 6)}] ${r.urls.length} URLs read - ${ageStr}`;
				}
				return `[${r.id.slice(0, 6)}] ${r.type} - ${ageStr}`;
			});

			const choice = await ctx.ui.select("Stored Web Results", options);
			if (!choice) return;

			const match = choice.match(/^\[([a-z0-9]+)\]/);
			if (!match) return;

			const selected = results.find((r) => r.id.startsWith(match[1]));
			if (!selected) return;

			const actions = ["View details", "Delete"];
			const action = await ctx.ui.select(`Result ${selected.id.slice(0, 6)}`, actions);

			if (action === "Delete") {
				deleteResult(selected.id);
				ctx.ui.notify(`Deleted ${selected.id.slice(0, 6)}`, "info");
			} else if (action === "View details") {
				let info = `ID: ${selected.id}\nType: ${selected.type}\nAge: ${Math.floor((Date.now() - selected.timestamp) / 60000)}m\n\n`;
				if (selected.type === "search" && selected.queries) {
					info += "Queries:\n";
					const queries = selected.queries.slice(0, 10);
					for (const q of queries) {
						info += `- "${q.query}" (${q.results.length} results)\n`;
					}
					if (selected.queries.length > 10) {
						info += `... and ${selected.queries.length - 10} more\n`;
					}
				}
				if (selected.type === "fetch" && selected.urls) {
					info += "URLs:\n";
					const urls = selected.urls.slice(0, 10);
					for (const u of urls) {
						const urlDisplay = u.url.length > 50 ? u.url.slice(0, 47) + "..." : u.url;
						info += `- ${urlDisplay} (${u.error || `${u.content.length} chars`})\n`;
					}
					if (selected.urls.length > 10) {
						info += `... and ${selected.urls.length - 10} more\n`;
					}
				}
				ctx.ui.notify(info, "info");
			}
		},
	});
}

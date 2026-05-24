import { activityMonitor } from "./activity.js";
import { hasExaApiKey, searchWithExa } from "./exa.js";
import type { SearchResponse, SearchOptions } from "./types.js";

const MAX_NUM_RESULTS = 20;

export interface FullSearchOptions extends SearchOptions {
	includeContent?: boolean;
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function isAbortError(err: unknown): boolean {
	return errorMessage(err).toLowerCase().includes("abort");
}

export async function search(query: string, options: FullSearchOptions = {}): Promise<SearchResponse> {
	const activityId = activityMonitor.logStart({ type: "api", query });

	try {
		const result = await searchWithExa(query, options);
		if (result && "exhausted" in result) {
			throw new Error(
				"Exa monthly free tier exhausted (1,000 requests). Resets next month.\n" +
				"  Upgrade at exa.ai/pricing"
			);
		}
		if (result && "answer" in result) {
			activityMonitor.logComplete(activityId, 200);
			return result;
		}
		// null result from MCP with no API key
		throw new Error(
			"No search provider available. Either:\n" +
			"  1. Set EXA_API_KEY (or exaApiKey in ~/.pi/web-search.json)\n" +
			"  2. Use Exa MCP (no API key needed)"
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (isAbortError(err)) {
			activityMonitor.logComplete(activityId, 0);
		} else {
			activityMonitor.logError(activityId, message);
		}
		throw err;
	}
}

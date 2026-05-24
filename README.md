<p>
  <img src="banner.png" alt="pi-web-search" width="1100">
</p>

# Pi Web Search

**Exa-powered web search and content extraction for Pi coding agent. Zero-config Exa MCP search, or bring your own API key.**

[![npm version](https://img.shields.io/npm/v/@alexion42/pi-web-search?style=for-the-badge)](https://www.npmjs.com/package/@alexion42/pi-web-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows*-blue?style=for-the-badge)]()

## Why Pi Web Search

**Lean fork of [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) (532★). Stripped out: Perplexity, Gemini API, Gemini Web, YouTube/video analysis, browser-cookie auth, curator UI, summary review, and librarian skill. What remains: Exa-only search, GitHub cloning, PDF extraction, and URL fetching via Readability → RSC → Jina.

### Other Pi search extensions

| Extension | Stars | Backends | Differentiator |
|-----------|-------|----------|----------------|
| [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) | 532 | Perplexity, Gemini, Exa | Upstream — curator, YouTube, video |
| [ronnieops/pi-search-hub](https://github.com/ronnieops/pi-search-hub) | 15 | 12 backends (DDG, Tavily, Brave, Exa, Serper, etc.) | RRF combine mode, auto-fallback |
| [code-yeongyu/pi-websearch](https://github.com/code-yeongyu/pi-websearch) | — | 11 backends + native OpenAI/Anthropic | Provider routing, keyless DDG |
| [ayagmar/pi-codex-web-search](https://github.com/ayagmar/pi-codex-web-search) | 17 | OpenAI Codex CLI | Wraps local `codex` CLI |
| [iaptsiauri/pi-surf](https://github.com/iaptsiauri/pi-surf) | — | Brave + custom providers | Scout subagent, pluggable providers |
| [NicoAvanzDev/pi-web-extension](https://github.com/NicoAvanzDev/pi-web-extension) | — | Brave, DDG (keyless) | Prompt steering, token-aware |

This project's niche: **GitHub cloning + Exa MCP zero-config in a lean package**. No multi-provider routing, no browser UI, no video.

**GitHub Cloning** — GitHub URLs are cloned locally instead of scraped. The agent gets real file contents and a local path to explore, not rendered HTML.

**Smart Fallbacks** — Content extraction uses a robust fallback chain: Readability → RSC parser → Jina Reader for JS-rendered pages.

## Install

```bash
pi install npm:@alexion42/pi-web-search
```

Works immediately with no API keys — Exa MCP provides zero-config search. For direct API access, add your key to `~/.pi/web-search.json`:

```json
{
  "exaApiKey": "exa-..."
}
```

Requires Pi v0.37.3+.

## Quick Start

```typescript
// Search the web
web_search({ query: "TypeScript best practices 2025" })

// Fetch a page
fetch_content({ url: "https://docs.example.com/guide" })

// Clone a GitHub repo
fetch_content({ url: "https://github.com/owner/repo" })
```

## Tools

### web_search

Search the web via Exa. Returns a synthesized answer with source citations.

```typescript
web_search({ query: "rust async programming" })
web_search({ queries: ["query 1", "query 2"] })
web_search({ query: "latest news", numResults: 10, recencyFilter: "week" })
web_search({ query: "...", domainFilter: ["github.com"] })
web_search({ query: "...", includeContent: true })
```

| Parameter | Description |
|-----------|-------------|
| `query` / `queries` | Single query or batch of queries |
| `numResults` | Results per query (default: 5, max: 20) |
| `recencyFilter` | `day`, `week`, `month`, or `year` |
| `domainFilter` | Limit to domains (prefix with `-` to exclude) |
| `includeContent` | Fetch full page content from sources in background |

### code_search

Search for code examples, documentation, and API references via Exa MCP. No API key required.

```typescript
code_search({ query: "React useEffect cleanup pattern" })
code_search({ query: "Express middleware error handling", maxTokens: 10000 })
```

| Parameter | Description |
|-----------|-------------|
| `query` | Programming question, API, library, or debugging topic |
| `maxTokens` | Maximum tokens of context to return (default: 5000, max: 50000) |

### fetch_content

Fetch URL(s) and extract readable content as markdown. Automatically detects and handles GitHub repos, PDFs, and regular web pages.

```typescript
fetch_content({ url: "https://example.com/article" })
fetch_content({ urls: ["url1", "url2", "url3"] })
fetch_content({ url: "https://github.com/owner/repo" })
```

| Parameter | Description |
|-----------|-------------|
| `url` / `urls` | Single URL/path or multiple URLs |
| `forceClone` | Clone GitHub repos that exceed the 350MB size threshold |

### get_search_content

Retrieve stored content from previous searches or fetches. Content over 30,000 chars is truncated in tool responses but stored in full for retrieval here.

```typescript
get_search_content({ responseId: "abc123", urlIndex: 0 })
get_search_content({ responseId: "abc123", url: "https://..." })
get_search_content({ responseId: "abc123", query: "original query" })
```

## Capabilities

### GitHub repos

GitHub URLs are cloned locally instead of scraped. The agent gets real file contents and a local path to explore with `read` and `bash`. Root URLs return the repo tree + README, `/tree/` paths return directory listings, `/blob/` paths return file contents.

Repos over 350MB get a lightweight API-based view instead of a full clone (override with `forceClone: true`). Commit SHA URLs are handled via the API. Clones are cached for the session and wiped on session change. Private repos require the `gh` CLI.

### PDFs

PDF URLs are extracted as text and saved to `~/Downloads/` as markdown. The agent can then `read` specific sections without loading the full document into context. Text-based extraction only — no OCR.

### Blocked pages

When Readability fails or returns only a cookie notice, the extension retries via Jina Reader (handles JS rendering server-side, no API key needed). Handles SPAs, JS-heavy pages, and anti-bot protections transparently. Also parses Next.js RSC flight data when present.

## How It Works

```
web_search(query)
  → Exa (direct API with key, MCP without)

fetch_content(url)
  → GitHub URL?  Clone repo, return file contents + local path
  → HTTP fetch → PDF? Extract text, save to ~/Downloads/
               → HTML? Readability → RSC parser → Jina Reader
               → Text/JSON/Markdown? Return directly
```

## Skills

### librarian

Bundled research workflow for investigating open-source libraries. Combines GitHub cloning, web search, and git operations (blame, log, show) to produce evidence-backed answers with permalinks. Pi loads it automatically based on your prompt.

## Commands

### /search

Browse stored search results interactively. Lists all results from the current session with their response IDs for easy retrieval.

## Activity Monitor

Toggle with **Ctrl+Shift+W** to see live request/response activity:

```
─── Web Search Activity ────────────────────────────────────
  API  "typescript best practices"     200    2.1s ✓
  GET  docs.example.com/article        200    0.8s ✓
  GET  blog.example.com/post           404    0.3s ✗
────────────────────────────────────────────────────────────
```

## Configuration

All config lives in `~/.pi/web-search.json`. Every field is optional.

```json
{
  "exaApiKey": "exa-...",
  "githubClone": {
    "enabled": true,
    "maxRepoSizeMB": 350,
    "cloneTimeoutSeconds": 30,
    "clonePath": "/tmp/pi-github-repos"
  },
  "shortcuts": {
    "activity": "ctrl+shift+w"
  }
}
```

`EXA_API_KEY` env var takes precedence over config file values.

### Shortcuts

Configurable via `~/.pi/web-search.json`:

```json
{
  "shortcuts": {
    "activity": "ctrl+shift+w"
  }
}
```

Values use the same format as pi keybindings. Changes take effect on next pi restart.

Config changes require a Pi restart.

Rate limits: Content fetches run 3 concurrent with a 30s timeout per URL.

## Limitations

- PDFs are text-extracted only (no OCR for scanned documents).
- GitHub branch names with slashes may misresolve file paths; the clone still works and the agent can navigate manually.
- Non-code GitHub URLs (issues, PRs, wiki) fall through to normal web extraction.

<details>
<summary>Files</summary>

| File | Purpose |
|------|---------|
| `index.ts` | Extension entry, tool definitions, command |
| `search.ts` | Exa search wrapper |
| `exa.ts` | Exa.ai search provider — direct API and MCP proxy, budget tracking |
| `code-search.ts` | Code/docs search via Exa MCP |
| `extract.ts` | URL/file path routing, HTTP extraction, fallback orchestration |
| `github-extract.ts` | GitHub URL parsing, clone cache, content generation |
| `github-api.ts` | GitHub API fallback for large repos and commit SHAs |
| `pdf-extract.ts` | PDF text extraction, saves to markdown |
| `rsc-extract.ts` | RSC flight data parser for Next.js pages |
| `types.ts` | Shared type definitions |
| `utils.ts` | Shared formatting and error helpers |
| `storage.ts` | Session-aware result storage |
| `activity.ts` | Activity tracking for the observability widget |
| `skills/librarian/` | Bundled skill for library research |

</details>

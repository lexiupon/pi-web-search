# Tools Reference

Detailed parameter reference and usage examples for all tools provided by Pi Web Search.

## web_search

Search the web via Exa. Returns an AI-synthesized answer with source citations.

```typescript
web_search({ query: "TypeScript best practices 2025" })
web_search({ queries: ["query 1", "query 2"] })
web_search({ query: "latest news", numResults: 10, recencyFilter: "week" })
web_search({ query: "...", domainFilter: ["github.com"] })
web_search({ query: "...", includeContent: true })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Single search query. For research tasks, prefer `queries` with multiple varied angles instead. |
| `queries` | `string[]` | Multiple queries searched in sequence, each returning its own synthesized answer. |
| `numResults` | `number` | Results per query (default: 5, max: 20) |
| `recencyFilter` | `string` | Filter by recency: `day`, `week`, `month`, or `year` |
| `domainFilter` | `string[]` | Limit to specific domains (prefix with `-` to exclude, e.g. `["-twitter.com"]`) |
| `includeContent` | `boolean` | Fetch full page content from sources in background |

**Tips:** For comprehensive research, use 2-4 varied queries instead of one broad query. Each query gets its own synthesized answer.

## code_search

Search for code examples, documentation, and API references via Exa MCP. No API key required.

```typescript
code_search({ query: "React useEffect cleanup pattern" })
code_search({ query: "Express middleware error handling", maxTokens: 10000 })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | Programming question, API, library, or debugging topic to search for |
| `maxTokens` | `number` | Maximum tokens of code/documentation context to return (default: 5000, max: 50000) |

## fetch_content

Fetch URL(s) and extract readable content as markdown. Automatically detects and handles GitHub repos, PDFs, and regular web pages.

```typescript
fetch_content({ url: "https://example.com/article" })
fetch_content({ urls: ["url1", "url2", "url3"] })
fetch_content({ url: "https://github.com/owner/repo" })
fetch_content({ url: "https://example.com/doc.pdf" })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | Single URL to fetch |
| `urls` | `string[]` | Multiple URLs (fetched in parallel) |
| `forceClone` | `boolean` | Force cloning large GitHub repositories that exceed the size threshold |

**GitHub repos:** GitHub URLs are cloned locally instead of scraped. The agent gets real file contents and a local path to explore with `read` and `bash`. Root URLs return the repo tree + README, `/tree/` paths return directory listings, `/blob/` paths return file contents. Repos over 350MB get a lightweight API-based view (override with `forceClone: true`).

**PDFs:** PDF URLs are extracted as text and saved to `~/Downloads/` as markdown. Text-based extraction only — no OCR.

**Fallback chain:** Readability → RSC parser (Next.js) → Jina Reader (JS-rendered pages). Handles SPAs, JS-heavy pages, and anti-bot protections transparently.

## get_search_content

Retrieve stored content from previous `web_search` or `fetch_content` calls. Content over 30,000 chars is truncated in tool responses but stored in full for retrieval here.

```typescript
get_search_content({ responseId: "abc123", urlIndex: 0 })
get_search_content({ responseId: "abc123", url: "https://..." })
get_search_content({ responseId: "abc123", query: "original query" })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `responseId` | `string` | The response ID from a previous `web_search` or `fetch_content` call |
| `query` | `string` | Get content for this specific query (from `web_search` results) |
| `queryIndex` | `number` | Get content for query at this index (0-based) |
| `url` | `string` | Get content for this specific URL (from `fetch_content` results) |
| `urlIndex` | `number` | Get content for URL at this index (0-based) |

## /search

Interactive command to browse stored search results from the current session. Lists all results with their response IDs for easy retrieval. Supports viewing details and deleting results.

```
/search
```

## Activity Monitor

Toggle with `Ctrl+Shift+W` (configurable via `shortcuts.activity` in config) to see live request/response activity:

```
─── Web Search Activity ────────────────────────────────────
  API  "typescript best practices"     200    2.1s ✓
  GET  docs.example.com/article        200    0.8s ✓
  GET  blog.example.com/post           404    0.3s ✗
────────────────────────────────────────────────────────────
```

Shows the last 10 API calls and URL fetches with status codes, timing, and rate limit usage. Auto-clears on session switch.

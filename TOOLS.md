# Tools Reference

Detailed parameter reference and usage examples for all tools provided by Pi Web Search.

## web

Single web tool.

- `mode: "search"` — search the web from query terms to discover sources
- `mode: "read"` — read one known URL and extract readable text/markdown
- `mode: "get"` — retrieve a stored result from an earlier `web` call by `resultId`

```typescript
web({ mode: "search", query: "TypeScript best practices 2025" })
web({ mode: "search", query: "latest news", numResults: 10 })
web({ mode: "read", url: "https://example.com/article" })
web({ mode: "read", url: "https://github.com/owner/repo" })
web({ mode: "get", resultId: "abc123" })
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mode` | `"search" \| "read" \| "get"` | Selects the operation |
| `query` | `string` | For `mode: "search"`: one search query string |
| `numResults` | `number` | For `mode: "search"`: how many search results to return (default: 5, max: 20) |
| `url` | `string` | For `mode: "read"`: one known URL to read |
| `forceClone` | `boolean` | For `mode: "read"` on GitHub repo URLs: force cloning large repositories |
| `resultId` | `string` | For `mode: "get"`: stored result id from an earlier `web` call |

### Search mode

Use when you have keywords and need to discover sources.

### Read mode

Use when you already have a URL and want the page/repo/PDF contents.

**GitHub repos:** GitHub URLs are cloned locally instead of scraped. The agent gets real file contents and a local path to explore with `read` and `bash`. Root URLs return the repo tree + README, `/tree/` paths return directory listings, `/blob/` paths return file contents. Repos over 350MB get a lightweight API-based view (override with `forceClone: true`).

**PDFs:** PDF URLs are extracted as text and saved to `~/Downloads/` as markdown. Text-based extraction only — no OCR.

**Fallback chain:** Readability → RSC parser (Next.js) → Jina Reader (JS-rendered pages). Handles SPAs, JS-heavy pages, and anti-bot protections transparently.

### Get mode

Use after a previous `web(...)` call returns a `resultId` and you want to reload the stored result from the current session.

## /search

Interactive command to browse stored web results from the current session. Lists all results with their ids for easy retrieval. Supports viewing details and deleting results.

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

# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-05-24

- Fixed warnings from `npm audit`
- Upgraded dependencies to the latest versions

## [0.1.0] - 2026-05-24

Initial release as `@alexion42/pi-web-search`.

Lean fork of [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access). Stripped out: Perplexity, Gemini API, Gemini Web, YouTube/video analysis, browser-cookie auth, curator UI, summary review, and librarian skill. What remains: Exa-only search, GitHub cloning, PDF extraction, and URL fetching via Readability → RSC → Jina.

### Included

- `web_search` — Exa search with synthesized answers (direct API or zero-config MCP)
- `code_search` — Code/docs search via Exa MCP
- `fetch_content` — URL content extraction with GitHub cloning and PDF support
- `get_search_content` — Retrieve stored search/fetch results
- `/search` — Interactive command to browse stored results
- Activity monitor (`Ctrl+Shift+W`)

# Pi Web Search

Lean web search for Pi, powered by Exa. A lean fork of [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access).

[![npm version](https://img.shields.io/npm/v/@alexion42/pi-web-search?style=for-the-badge)](https://www.npmjs.com/package/@alexion42/pi-web-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

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

## What's Available

| Tool | Description |
|------|-------------|
| `web_search` | Search the web via Exa with synthesized answers and source citations |
| `code_search` | Search for code examples, docs, and API references via Exa MCP |
| `fetch_content` | Extract readable content from URLs, GitHub repos (cloned locally), and PDFs |
| `get_search_content` | Retrieve stored content from previous searches or fetches |
| `/search` | Interactive command to browse stored search results |
| Activity monitor | `Ctrl+Shift+W` to view live request/response activity |

Content extraction uses a robust fallback chain: Readability → RSC parser → Jina Reader. Full parameter reference and examples are in [TOOLS.md](./TOOLS.md).

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

`EXA_API_KEY` env var takes precedence over config file values. Config changes require a Pi restart.

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

## Limitations

- PDFs are text-extracted only (no OCR for scanned documents).
- GitHub branch names with slashes may misresolve file paths; the clone still works and the agent can navigate manually.
- Non-code GitHub URLs (issues, PRs, wiki) fall through to normal web extraction.

## Comparison with Other Pi Search Extensions

| Extension | Backends | Differentiator |
|-----------|----------|----------------|
| [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) | Perplexity, Gemini, Exa | Upstream — curator, YouTube, video |
| [ronnieops/pi-search-hub](https://github.com/ronnieops/pi-search-hub) | 12 backends | RRF combine mode, auto-fallback |
| [code-yeongyu/pi-websearch](https://github.com/code-yeongyu/pi-websearch) | 11 backends + native OpenAI/Anthropic | Provider routing, keyless DDG |
| [ayagmar/pi-codex-web-search](https://github.com/ayagmar/pi-codex-web-search) | OpenAI Codex CLI | Wraps local `codex` CLI |
| [iaptsiauri/pi-surf](https://github.com/iaptsiauri/pi-surf) | Brave + custom providers | Scout subagent, pluggable providers |
| [NicoAvanzDev/pi-web-extension](https://github.com/NicoAvanzDev/pi-web-extension) | Brave, DDG (keyless) | Prompt steering, token-aware |

This project's niche: **GitHub cloning + Exa MCP zero-config in a lean package**. No multi-provider routing, no browser UI, no video.

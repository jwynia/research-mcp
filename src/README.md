# Research MCP Server

This is an MCP server implementation providing research capabilities, from basic web search to deep research reports, built using [FastMCP](https://github.com/punkpeye/fastmcp).

## Features

- **Basic Web Search**: Tool for simple web queries.
- **Light Research Report**: Tool for generating brief, high-level research summaries using Perplexity's Sonar model.
- **Medium Research Report**: Tool for generating moderately detailed research reports using Perplexity's Sonar Medium model.
- **Deep Research Report**: Tool for generating in-depth research reports on a given topic, powered by Perplexity's Sonar Deep Research API.
- **URL Content Capture**: Tool for capturing content from URLs and converting it to Markdown format, supporting HTML, PDF, and DOCX documents.
- **Automatic Citation Archiving**: Research reports automatically extract and archive cited URLs in the background.
- **Research Archiving**: All research queries and their results are archived for future reference and indexing.
- **MCP Protocol**: Exposes tools via the Model Context Protocol (MCP) using SSE.

## Project Structure

```
mcp-servers-src/research/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts
    ├── server.ts
    └── tools/
        ├── basicWebSearch.ts
        ├── captureUrlContent.ts
        ├── deepResearchReport.ts
        ├── lightResearchReport.ts
        ├── mediumResearchReport.ts
        └── base/
            └── baseResearchReport.ts
```

## Getting Started

### Environment Variables

Create a `.env` file in the project root or set these variables in your environment:

```
PERPLEXITY_API_KEY=your_perplexity_api_key
# Optional: server configuration
PORT=3100
# Optional: override model for each report type
PERPLEXITY_LIGHT_MODEL=sonar
PERPLEXITY_MEDIUM_MODEL=sonar-medium-online
PERPLEXITY_DEEP_MODEL=sonar-deep-research
PERPLEXITY_MAX_TOKENS=4000
PERPLEXITY_TEMPERATURE=0.7
RESEARCH_ARCHIVE_PATH=./research-archive

# URL Content Capture Configuration (Optional)
URL_CONTENT_ARCHIVE_PATH=./url-content-archive
ARCHIVE_CITATIONS=true
MAX_REQUESTS_PER_DOMAIN_PER_HOUR=10
REQUEST_DELAY_MS=2000
```

- `PERPLEXITY_API_KEY` (required): Your Perplexity API key.
- `PORT` (optional): Port number for the server to listen on (default: `3100`).
- `PERPLEXITY_LIGHT_MODEL` (optional): Model for light research reports (default: `sonar`).
- `PERPLEXITY_MEDIUM_MODEL` (optional): Model for medium research reports (default: `sonar-medium-online`).
- `PERPLEXITY_DEEP_MODEL` (optional): Model for deep research reports (default: `sonar-deep-research`).
- `PERPLEXITY_MAX_TOKENS` (optional): Max tokens for Perplexity responses (default: 4000).
- `PERPLEXITY_TEMPERATURE` (optional): Sampling temperature (default: 0.7).
- `RESEARCH_ARCHIVE_PATH` (optional): Directory for archiving research results (default: `./research-archive`).

1. **Install dependencies:**
   ```
   npm install
   ```

2. **Run the server in development mode:**
   ```
   npm run dev
   ```

3. **Build for production:**
   ```
   npm run build
   ```

4. **Start the built server:**
   ```
   npm start
   ```

## Endpoints

- **SSE Endpoint:** `http://localhost:{PORT}/mcp-sse` (default: `http://localhost:3100/mcp-sse`)

## Tool Examples

- **basicWebSearch**:  
  Input: `{ "query": "latest AI research" }`  
  Output: `"Search results for: latest AI research"`

- **lightResearchReport**:  
  Input: `{ "topic": "AI in education" }`  
  Output: `"Concise summary with key findings and citations..."`

- **mediumResearchReport**:  
  Input: `{ "topic": "AI in education", "detailed": false }`  
  Output: `"Moderately detailed report with clear sections and citations..."`

- **deepResearchReport**:  
  Input: `{ "topic": "quantum computing", "detailed": true }`  
  Output: `"Comprehensive research report with citations and thorough analysis..."`

- **captureUrlContent**:  
  Input: `{ "url": "https://example.com/article", "includeMetadata": true }`  
  Output: `"Markdown content of the captured URL with optional metadata..."`

  - All research queries and their results are archived in the directory specified by `RESEARCH_ARCHIVE_PATH`.
  - Each query is stored by a hash, with metadata and the full Perplexity API response.
  - URL content is archived in the directory specified by `URL_CONTENT_ARCHIVE_PATH`.
  - Research reports automatically extract and archive cited URLs in the background.
  - See `context-network/planning/research-archive-indexing.md` for future plans on search and indexing.


## License

MIT

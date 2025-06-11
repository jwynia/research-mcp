import { FastMCP } from "fastmcp";
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { basicWebSearch } from "./tools/basicWebSearch";
import { deepResearchReport } from "./tools/deepResearchReport";
import { lightResearchReport } from "./tools/lightResearchReport";
import { mediumResearchReport } from "./tools/mediumResearchReport";
import { captureUrlContent } from "./tools/captureUrlContent";
import { searchLocalArchives } from "./tools/searchLocalArchives";
import { createSearchIndex } from "./search";

// Load environment variables
dotenv.config();

export async function startServer(options?: { port?: number }) {
  // Get port from options, environment variable, or use default
  const port = options?.port || (process.env.PORT ? parseInt(process.env.PORT) : 3100);
  const server = new FastMCP({
    name: "Research MCP Server",
    version: "0.1.0",
    instructions: "This server provides research tools from basic web search to deep, medium, and light research reports."
  });

  server.addTool(basicWebSearch);
  server.addTool(lightResearchReport);
  server.addTool(mediumResearchReport);
  server.addTool(deepResearchReport);
  server.addTool(captureUrlContent);
  // Initialize search index
  const searchIndex = await createSearchIndex({
    dbPath: process.env.SEARCH_DB_PATH || path.join(process.cwd(), 'data', 'search.db'),
    researchPath: process.env.RESEARCH_ARCHIVE_PATH || path.join(process.cwd(), 'research-archive'),
    urlContentPath: process.env.URL_CONTENT_ARCHIVE_PATH || path.join(process.cwd(), 'url-content-archive'),
    initializeDb: true
  });
  
  // Run initial indexing
  searchIndex.runIndexing().catch(error => {
    console.error('Initial indexing failed:', error.message);
  });
  
  // Set up scheduled indexing
  searchIndex.setupTriggers({
    schedule: process.env.INDEXING_SCHEDULE || '0 * * * *', // Default: every hour
    watchFiles: process.env.WATCH_FILES === 'true',
    watchDirs: [
      process.env.RESEARCH_ARCHIVE_PATH || path.join(process.cwd(), 'research-archive'),
      process.env.URL_CONTENT_ARCHIVE_PATH || path.join(process.cwd(), 'url-content-archive')
    ]
  });

  server.addTool(searchLocalArchives);

  server.start({
    transportType: "sse",
    sse: {
      endpoint: "/mcp-sse",
      port
    }
  });

  console.log(`Research MCP Server running at http://localhost:${port}`);
  console.log(`SSE endpoint: http://localhost:${port}/mcp-sse`);
  console.log(`Search indexing system initialized and running`);
}

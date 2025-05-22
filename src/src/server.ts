import { FastMCP } from "fastmcp";
import { z } from "zod";
import dotenv from "dotenv";
import { basicWebSearch } from "./tools/basicWebSearch";
import { deepResearchReport } from "./tools/deepResearchReport";
import { lightResearchReport } from "./tools/lightResearchReport";
import { mediumResearchReport } from "./tools/mediumResearchReport";
import { captureUrlContent } from "./tools/captureUrlContent";

// Load environment variables
dotenv.config();

export function startServer(options?: { port?: number }) {
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

  server.start({
    transportType: "sse",
    sse: {
      endpoint: "/mcp-sse",
      port
    }
  });

  console.log(`Research MCP Server running at http://localhost:${port}`);
  console.log(`SSE endpoint: http://localhost:${port}/mcp-sse`);
}

# Research MCP

A Model Context Protocol (MCP) server implementation providing advanced research capabilities, from basic web searches to comprehensive research reports.

## Overview

This project is a Research MCP implementation that uses the Perplexity.ai API, DuckDuckGo, and Cheerio to provide a range of research tasks from page retrieval and quick searches to deep research reports. It saves what it gathers for future indexing and pre-searching.

## Features

- **Basic Web Search**: Simple web queries powered by DuckDuckGo
- **Research Reports**: Generate research reports at various detail levels using Perplexity AI
  - Light Reports: Brief, high-level summaries using Perplexity's Sonar model
  - Medium Reports: Moderately detailed reports using Perplexity's Sonar Medium model
  - Deep Reports: In-depth, comprehensive research using Perplexity's Sonar Deep Research API
- **URL Content Capture**: Extract and convert web content to Markdown, supporting HTML, PDF, and DOCX
- **Automatic Citation Archiving**: Extract and archive URLs cited in research reports
- **Research Archiving**: Store all research queries and results for future reference
- **MCP Protocol Integration**: Expose all capabilities via the Model Context Protocol

## Built With

This project is built using [FastMCP](https://github.com/punkpeye/fastmcp), a TypeScript framework for rapidly developing MCP servers.

## Getting Started

See the [src/README.md](src/README.md) file for detailed installation and usage instructions.

## Docker Deployment

You can deploy this project using Docker and Docker Compose:

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd research-mcp
   ```

2. **Configure environment variables:**
   ```bash
   cp src/.env.example src/.env
   # Edit src/.env with your API keys and configuration
   ```

3. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Access the MCP server:**
   The MCP server will be available at `http://localhost:3100/mcp-sse`

5. **Monitor logs:**
   ```bash
   docker-compose logs -f
   ```

6. **Stop the service:**
   ```bash
   docker-compose down
   ```
## Client Config
Put this in your MCP config file:
```
{
  "mcpServers": {
    "Research": {
        "timeout": 1800,
        "transportType": "sse",
        "url": "http://localhost:3100/mcp-sse"
      }
  }
}
```

## Project Structure

The project is organized into two main parts:
1. Implementation files in the `src/` directory
2. Planning and documentation in the `context-network/` directory

## Documentation

For more detailed information about the project architecture, planning, and development decisions, please refer to the [context-network](./context-network/) directory.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

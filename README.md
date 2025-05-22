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

## Project Structure

The project is organized into two main parts:
1. Implementation files in the `src/` directory
2. Planning and documentation in the `context-network/` directory

## Documentation

For more detailed information about the project architecture, planning, and development decisions, please refer to the [context-network](./context-network/) directory.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

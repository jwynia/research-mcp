# MCP Tool Specification

## Purpose
This document provides detailed specifications for the MCP tool that will expose the search indexing functionality to AI assistants through the Model Context Protocol.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The searchLocalArchives MCP tool will provide AI assistants with the ability to search the local research and URL content archives. It will leverage the Search API to perform searches and return results in a format suitable for consumption by AI assistants.

### File Location

```
src/src/tools/searchLocalArchives.ts
```

### Dependencies

```typescript
import { Tool } from 'fastmcp';
import { z } from 'zod';
import path from 'path';
import { SearchAPI } from '../search/searchApi';
import { SearchOptions, SearchResult } from '../search/types';
```

### Tool Definition

```typescript
/**
 * Path to the SQLite database file
 * This should be configured based on the environment
 */
const DB_PATH = process.env.SEARCH_DB_PATH || path.join(process.cwd(), 'data', 'search.db');

/**
 * MCP tool for searching local archives
 */
export const searchLocalArchives: Tool = {
  name: 'searchLocalArchives',
  description: 'Searches the local research and URL content archives',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      fuzzy: {
        type: 'boolean',
        description: 'Whether to enable fuzzy matching',
        default: true
      },
      includeCitations: {
        type: 'boolean',
        description: 'Whether to include citation information',
        default: false
      },
      citationDepth: {
        type: 'integer',
        description: 'How many levels of citations to include',
        default: 1,
        minimum: 1,
        maximum: 3
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of results to return',
        default: 10,
        minimum: 1,
        maximum: 50
      }
    },
    required: ['query']
  },
  handler: async (inputs, context) => {
    const { query, fuzzy = true, includeCitations = false, citationDepth = 1, limit = 10 } = inputs;
    
    try {
      // Initialize the search API
      const searchApi = new SearchAPI({
        dbPath: DB_PATH
      });
      
      // Perform the search
      const results = searchApi.search({
        query,
        fuzzy,
        includeCitations,
        citationDepth,
        limit
      });
      
      // Generate citation visualization if citations are included
      let citationGraph = undefined;
      if (includeCitations && results.length > 0) {
        const documentIds = results.map(result => result.document.id);
        citationGraph = searchApi.generateCitationVisualization(documentIds);
      }
      
      // Format the results for the MCP response
      return {
        results: formatResultsForMCP(results),
        citationGraph,
        metadata: {
          totalResults: results.length,
          query,
          fuzzy,
          includeCitations,
          citationDepth,
          limit
        }
      };
    } catch (error) {
      console.error(`Error in searchLocalArchives tool: ${error.message}`);
      throw new Error(`Failed to search local archives: ${error.message}`);
    }
  }
};

/**
 * Format search results for MCP response
 * This ensures the results are in a format suitable for AI assistants
 */
function formatResultsForMCP(results: SearchResult[]) {
  return results.map(result => ({
    document: {
      id: result.document.id,
      title: result.document.title,
      path: result.document.path,
      source: result.document.source,
      date: result.document.date,
      score: result.document.score
    },
    highlights: result.matches.map(match => ({
      field: match.field,
      snippets: match.snippets
    })),
    citations: result.citations ? {
      citing: result.citations.citing.map(citation => ({
        sourceId: citation.sourceId,
        targetId: citation.targetId,
        targetUrl: citation.targetUrl,
        context: citation.context,
        confidence: citation.confidence
      })),
      cited: result.citations.cited.map(citation => ({
        sourceId: citation.sourceId,
        targetId: citation.targetId,
        targetUrl: citation.targetUrl,
        context: citation.context,
        confidence: citation.confidence
      }))
    } : undefined
  }));
}
```

### Server Integration

The tool needs to be registered with the MCP server in `src/src/server.ts`:

```typescript
import { searchLocalArchives } from './tools/searchLocalArchives';

// In the startServer function, add:
server.addTool(searchLocalArchives);
```

### Example Usage

AI assistants will be able to use the tool like this:

```json
{
  "query": "machine learning",
  "fuzzy": true,
  "includeCitations": true,
  "limit": 5
}
```

Example response:

```json
{
  "results": [
    {
      "document": {
        "id": "doc-123",
        "title": "Introduction to Machine Learning",
        "path": "research-archive/2025-05-20/machine_learning_intro.md",
        "source": "research",
        "date": "2025-05-20",
        "score": 0.95
      },
      "highlights": [
        {
          "field": "title",
          "snippets": ["Introduction to <mark>Machine Learning</mark>"]
        },
        {
          "field": "content",
          "snippets": ["<mark>Machine learning</mark> is a subset of artificial intelligence..."]
        }
      ],
      "citations": {
        "citing": [
          {
            "sourceId": "doc-123",
            "targetId": "doc-456",
            "targetUrl": "https://example.com/ml-algorithms",
            "context": "For more information on ML algorithms, see [this resource](https://example.com/ml-algorithms).",
            "confidence": 1.0
          }
        ],
        "cited": []
      }
    },
    // Additional results...
  ],
  "citationGraph": {
    "nodes": [
      {
        "id": "doc-123",
        "label": "Introduction to Machine Learning",
        "type": "source"
      },
      {
        "id": "doc-456",
        "label": "Machine Learning Algorithms",
        "type": "target"
      }
    ],
    "edges": [
      {
        "from": "doc-123",
        "to": "doc-456",
        "confidence": 1.0
      }
    ]
  },
  "metadata": {
    "totalResults": 1,
    "query": "machine learning",
    "fuzzy": true,
    "includeCitations": true,
    "citationDepth": 1,
    "limit": 5
  }
}
```

### Error Handling

The tool should handle errors gracefully and provide meaningful error messages:

```typescript
try {
  // Tool implementation
} catch (error) {
  console.error(`Error in searchLocalArchives tool: ${error.message}`);
  throw new Error(`Failed to search local archives: ${error.message}`);
}
```

### Environment Configuration

The tool should support configuration through environment variables:

- `SEARCH_DB_PATH` - Path to the SQLite database file

If not provided, it should default to a sensible location within the project structure.

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - MCP Integration section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for MCP tool
  - [elements/search_indexing/search_api_specification.md](search_api_specification.md) - uses - MCP tool uses search API

## Navigation Guide
- **When to Use:** When implementing the MCP tool for the search indexing system
- **Next Steps:** Implement the searchLocalArchives.ts file after the search API is implemented
- **Related Tasks:** Server integration, tool testing

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of MCP tool specification
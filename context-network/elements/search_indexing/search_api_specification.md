# Search API Module Specification

## Purpose
This document provides detailed specifications for the Search API module, which serves as the primary interface for querying the search index.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The Search API module provides a high-level interface for searching the indexed content, with support for full-text search, citation-aware queries, and related document discovery. It abstracts the underlying database operations and provides a clean, consistent API for the MCP tools and other components.

### File Location

```
src/src/search/searchApi.ts
```

### Dependencies

```typescript
import { SearchDatabase } from './database';
import { CitationGraph } from './citationGraph';
import { Document, Citation, SearchOptions, SearchResult, CitationReport } from './types';
```

### Interface

```typescript
export interface SearchApiOptions {
  /**
   * Path to the SQLite database file
   */
  dbPath: string;
}

export class SearchAPI {
  /**
   * Constructor
   */
  constructor(options: SearchApiOptions);
  
  /**
   * Perform a search with citation awareness
   */
  search(options: SearchOptions): SearchResult[];
  
  /**
   * Find documents related to a specific document through the citation graph
   */
  findRelated(documentId: string, depth?: number): SearchResult[];
  
  /**
   * Generate a citation report for a document
   */
  generateCitationReport(documentId: string): CitationReport;
  
  /**
   * Generate a visualization of the citation network for a set of documents
   */
  generateCitationVisualization(documentIds: string[]): {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; confidence: number }>;
  };
}
```

### Implementation Details

#### Constructor

The constructor should initialize the database connection and citation graph:

```typescript
constructor(options: SearchApiOptions) {
  this.db = new SearchDatabase({
    dbPath: options.dbPath,
    createIfNotExists: true
  });
  
  this.citationGraph = new CitationGraph(this.db);
}
```

#### Search Method

The search method should implement the core search functionality:

```typescript
/**
 * Perform a search with citation awareness
 */
search(options: SearchOptions): SearchResult[] {
  const { query, fuzzy = false, fields = ['title', 'content', 'query'], limit = 50, includeCitations = false, citationDepth = 1 } = options;
  
  // Perform the basic search
  const results = this.db.searchDocuments(query, {
    fuzzy,
    fields,
    limit
  });
  
  // Convert to SearchResult format
  const searchResults = results.map(result => ({
    document: {
      id: result.document.id,
      title: result.document.title,
      path: result.document.path,
      source: result.document.source,
      date: result.document.date,
      score: result.score
    },
    matches: result.snippets.map(snippet => ({
      field: snippet.field,
      term: query, // This is simplified; in reality, we'd extract the matched terms
      snippets: [snippet.text]
    })),
    citations: undefined // Will be populated if includeCitations is true
  }));
  
  // Add citation information if requested
  if (includeCitations) {
    for (const result of searchResults) {
      const documentId = result.document.id;
      
      // Get citations in both directions
      const citing = this.db.getCitationsForDocument(documentId, 'citing');
      const cited = this.db.getCitationsForDocument(documentId, 'cited');
      
      // If citation depth > 1, recursively get more citations
      if (citationDepth > 1) {
        // Implementation for deeper citation traversal would go here
        // This would involve recursively fetching citations up to the specified depth
      }
      
      result.citations = {
        citing,
        cited
      };
    }
  }
  
  return searchResults;
}
```

#### Find Related Method

The findRelated method should use the citation graph to discover related documents:

```typescript
/**
 * Find documents related to a specific document through the citation graph
 */
findRelated(documentId: string, depth: number = 1): SearchResult[] {
  // Get the document to ensure it exists
  const document = this.db.getDocument(documentId);
  if (!document) {
    throw new Error(`Document with ID ${documentId} not found`);
  }
  
  // Get related document IDs through the citation graph
  const relatedIds = this.citationGraph.findRelatedDocuments(documentId, depth);
  
  // Fetch the full documents
  const relatedDocuments = relatedIds.map(id => this.db.getDocument(id)).filter(Boolean);
  
  // Convert to SearchResult format
  return relatedDocuments.map(doc => ({
    document: {
      id: doc.id,
      title: doc.title,
      path: doc.path,
      source: doc.source,
      date: doc.date,
      score: 1.0 // No relevance score for related documents
    },
    matches: [], // No matches for related documents
    citations: undefined // No citation info by default
  }));
}
```

#### Generate Citation Report Method

The generateCitationReport method should analyze citation patterns:

```typescript
/**
 * Generate a citation report for a document
 */
generateCitationReport(documentId: string): CitationReport {
  // Get the document to ensure it exists
  const document = this.db.getDocument(documentId);
  if (!document) {
    throw new Error(`Document with ID ${documentId} not found`);
  }
  
  // Get citations in both directions
  const citing = this.db.getCitationsForDocument(documentId, 'citing');
  const cited = this.db.getCitationsForDocument(documentId, 'cited');
  
  // Calculate metrics
  const outgoingCount = citing.length;
  const incomingCount = cited.length;
  const allConfidences = [...citing, ...cited].map(citation => citation.confidence);
  const averageConfidence = allConfidences.length > 0
    ? allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length
    : 0;
  
  // Generate network data for visualization
  const network = this.generateCitationVisualization([documentId]);
  
  return {
    documentId,
    metrics: {
      outgoingCount,
      incomingCount,
      averageConfidence
    },
    network
  };
}
```

#### Generate Citation Visualization Method

The generateCitationVisualization method should create visualization data:

```typescript
/**
 * Generate a visualization of the citation network for a set of documents
 */
generateCitationVisualization(documentIds: string[]): {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; confidence: number }>;
} {
  const nodes = new Map();
  const edges = new Map();
  
  // Process each document
  for (const docId of documentIds) {
    // Get the document
    const document = this.db.getDocument(docId);
    if (!document) continue;
    
    // Add the document as a node
    nodes.set(docId, {
      id: docId,
      label: document.title,
      type: 'source'
    });
    
    // Get citations in both directions
    const citing = this.db.getCitationsForDocument(docId, 'citing');
    const cited = this.db.getCitationsForDocument(docId, 'cited');
    
    // Process outgoing citations
    for (const citation of citing) {
      if (citation.targetId) {
        // Add the target document as a node if it's not already there
        if (!nodes.has(citation.targetId)) {
          const targetDoc = this.db.getDocument(citation.targetId);
          if (targetDoc) {
            nodes.set(citation.targetId, {
              id: citation.targetId,
              label: targetDoc.title,
              type: 'target'
            });
          }
        }
        
        // Add the edge
        const edgeKey = `${docId}->${citation.targetId}`;
        edges.set(edgeKey, {
          from: docId,
          to: citation.targetId,
          confidence: citation.confidence
        });
      }
    }
    
    // Process incoming citations
    for (const citation of cited) {
      if (!nodes.has(citation.sourceId)) {
        const sourceDoc = this.db.getDocument(citation.sourceId);
        if (sourceDoc) {
          nodes.set(citation.sourceId, {
            id: citation.sourceId,
            label: sourceDoc.title,
            type: 'source'
          });
        }
      }
      
      // Add the edge
      const edgeKey = `${citation.sourceId}->${docId}`;
      edges.set(edgeKey, {
        from: citation.sourceId,
        to: docId,
        confidence: citation.confidence
      });
    }
  }
  
  // Update node types for documents that are both source and target
  for (const [id, node] of nodes.entries()) {
    let isSource = false;
    let isTarget = false;
    
    for (const edge of edges.values()) {
      if (edge.from === id) isSource = true;
      if (edge.to === id) isTarget = true;
      
      if (isSource && isTarget) {
        node.type = 'both';
        break;
      }
    }
  }
  
  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values())
  };
}
```

### Error Handling

The module should implement robust error handling:

```typescript
private handleError(operation: string, error: Error): never {
  console.error(`Search API error during ${operation}: ${error.message}`);
  throw new Error(`Search API error during ${operation}: ${error.message}`);
}
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Search API section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for search API
  - [elements/search_indexing/database_specification.md](database_specification.md) - uses - Search API uses database module
  - [elements/search_indexing/types_specification.md](types_specification.md) - uses - Search API uses type definitions

## Navigation Guide
- **When to Use:** When implementing the search API for the search indexing system
- **Next Steps:** Implement the searchApi.ts file after database.ts and citationGraph.ts
- **Related Tasks:** MCP tool implementation, citation graph implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of search API module specification
# Types Module Specification

## Purpose
This document provides detailed specifications for the TypeScript interfaces used throughout the search indexing system.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The types module defines the core data structures and interfaces used by all components of the search indexing system. It ensures type safety and consistency across the implementation.

### File Location

```
src/src/search/types.ts
```

### Dependencies

```typescript
// No external dependencies required
```

### Interface Definitions

#### Document Interface

Represents a document in the search index, which could be a research report or captured URL content.

```typescript
/**
 * Represents a document in the search index
 */
export interface Document {
  /**
   * Unique identifier for the document
   */
  id?: string;
  
  /**
   * Document title
   */
  title: string;
  
  /**
   * Path to the document file in the archive
   */
  path: string;
  
  /**
   * Source of the document ('research' or 'url-content')
   */
  source: 'research' | 'url-content';
  
  /**
   * Type of document ('report', 'search', 'webpage', etc.)
   */
  type: string;
  
  /**
   * Date the document was created or captured
   */
  date: string;
  
  /**
   * Full text content of the document
   */
  content: string;
  
  /**
   * Original research query if applicable
   */
  query?: string;
  
  /**
   * Additional metadata as a flexible JSON object
   */
  metadata?: Record<string, any>;
}
```

#### Citation Interface

Represents a citation relationship between documents.

```typescript
/**
 * Represents a citation relationship between documents
 */
export interface Citation {
  /**
   * Unique identifier for the citation
   */
  id?: string;
  
  /**
   * ID of the document containing the citation
   */
  sourceId: string;
  
  /**
   * URL being cited
   */
  targetUrl: string;
  
  /**
   * ID of the cited document (if in our archives)
   */
  targetId?: string;
  
  /**
   * Text surrounding the citation
   */
  context: string;
  
  /**
   * Confidence score (0.0-1.0, where 1.0 = explicit link)
   */
  confidence: number;
}
```

#### Search Options Interface

Defines options for search operations.

```typescript
/**
 * Options for search operations
 */
export interface SearchOptions {
  /**
   * The search query string
   */
  query: string;
  
  /**
   * Whether to enable fuzzy matching
   */
  fuzzy?: boolean;
  
  /**
   * Fields to search in ('title', 'content', 'query')
   */
  fields?: ('title' | 'content' | 'query')[];
  
  /**
   * Maximum number of results to return
   */
  limit?: number;
  
  /**
   * Whether to include citation relationships
   */
  includeCitations?: boolean;
  
  /**
   * How many levels of citations to include
   */
  citationDepth?: number;
}
```

#### Search Result Interface

Represents a search result with document and match information.

```typescript
/**
 * Represents a search result
 */
export interface SearchResult {
  /**
   * The matched document
   */
  document: {
    /**
     * Document ID
     */
    id: string;
    
    /**
     * Document title
     */
    title: string;
    
    /**
     * Path to the document file
     */
    path: string;
    
    /**
     * Source of the document
     */
    source: 'research' | 'url-content';
    
    /**
     * Date the document was created or captured
     */
    date: string;
    
    /**
     * Relevance score
     */
    score: number;
  };
  
  /**
   * Matching terms and snippets
   */
  matches: {
    /**
     * Field where the match occurred
     */
    field: string;
    
    /**
     * Matching term
     */
    term: string;
    
    /**
     * Text snippets showing the match in context
     */
    snippets: string[];
  }[];
  
  /**
   * Citation relationships (if requested)
   */
  citations?: {
    /**
     * Documents citing this one
     */
    citing: Citation[];
    
    /**
     * Documents cited by this one
     */
    cited: Citation[];
  };
}
```

#### Indexing Options Interface

Defines options for indexing operations.

```typescript
/**
 * Options for indexing operations
 */
export interface IndexingOptions {
  /**
   * Path to the research archive
   */
  researchPath: string;
  
  /**
   * Path to the URL content archive
   */
  urlContentPath: string;
  
  /**
   * Force reindexing even if unchanged
   */
  force?: boolean;
}
```

#### Indexing Stats Interface

Represents statistics about an indexing operation.

```typescript
/**
 * Statistics about an indexing operation
 */
export interface IndexingStats {
  /**
   * Number of documents scanned
   */
  scannedCount: number;
  
  /**
   * Number of new documents added
   */
  addedCount: number;
  
  /**
   * Number of documents updated
   */
  updatedCount: number;
  
  /**
   * Number of citations extracted
   */
  citationCount: number;
  
  /**
   * Time taken in milliseconds
   */
  timeTakenMs: number;
}
```

#### Citation Report Interface

Represents a report on citation relationships.

```typescript
/**
 * Report on citation relationships
 */
export interface CitationReport {
  /**
   * Document ID
   */
  documentId: string;
  
  /**
   * Citation metrics
   */
  metrics: {
    /**
     * Number of outgoing citations
     */
    outgoingCount: number;
    
    /**
     * Number of incoming citations
     */
    incomingCount: number;
    
    /**
     * Average confidence score
     */
    averageConfidence: number;
  };
  
  /**
   * Citation network data for visualization
   */
  network?: {
    /**
     * Network nodes
     */
    nodes: Array<{
      id: string;
      label: string;
      type: 'source' | 'target' | 'both';
    }>;
    
    /**
     * Network edges
     */
    edges: Array<{
      from: string;
      to: string;
      confidence: number;
    }>;
  };
}
```

### Type Exports

The module should export all interfaces:

```typescript
export {
  Document,
  Citation,
  SearchOptions,
  SearchResult,
  IndexingOptions,
  IndexingStats,
  CitationReport
};
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Core interfaces section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for types module
  - [elements/search_indexing/database_specification.md](database_specification.md) - uses - Database module uses these types

## Navigation Guide
- **When to Use:** When implementing any component of the search indexing system
- **Next Steps:** Implement the types.ts file, then proceed with other modules
- **Related Tasks:** Database implementation, search API implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of types module specification
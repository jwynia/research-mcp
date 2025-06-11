# Index Module Specification

## Purpose
This document provides detailed specifications for the main entry point of the search indexing system, which ties all the components together and provides a unified API.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The index module serves as the main entry point for the search indexing system, providing a unified API for other parts of the application to interact with. It initializes all the necessary components, manages their lifecycle, and exposes the core functionality in a clean, consistent interface.

### File Location

```
src/src/search/index.ts
```

### Dependencies

```typescript
import path from 'path';
import { SearchDatabase } from './database';
import { ArchiveScanner } from './archiveScanner';
import { ContentProcessor } from './contentProcessor';
import { CitationGraph } from './citationGraph';
import { SearchAPI } from './searchApi';
import { IndexingTrigger } from './indexingTrigger';
import { IndexingOptions, IndexingStats, SearchOptions, SearchResult } from './types';
```

### Interface

```typescript
export interface SearchIndexOptions {
  /**
   * Path to the SQLite database file
   */
  dbPath?: string;
  
  /**
   * Path to the research archive
   */
  researchPath?: string;
  
  /**
   * Path to the URL content archive
   */
  urlContentPath?: string;
  
  /**
   * Whether to initialize the database on creation
   */
  initializeDb?: boolean;
}

export class SearchIndex {
  /**
   * Constructor
   */
  constructor(options?: SearchIndexOptions);
  
  /**
   * Initialize the search index
   */
  initialize(): Promise<void>;
  
  /**
   * Run indexing job
   */
  runIndexing(options?: Partial<IndexingOptions>): Promise<IndexingStats>;
  
  /**
   * Set up indexing triggers
   */
  setupTriggers(options: {
    schedule?: string;
    watchFiles?: boolean;
    watchDirs?: string[];
  }): void;
  
  /**
   * Stop indexing triggers
   */
  stopTriggers(): void;
  
  /**
   * Search the index
   */
  search(options: SearchOptions): SearchResult[];
  
  /**
   * Find documents related to a specific document
   */
  findRelated(documentId: string, depth?: number): SearchResult[];
  
  /**
   * Generate a citation report for a document
   */
  generateCitationReport(documentId: string): any;
  
  /**
   * Get database statistics
   */
  getStats(): { documentCount: number; citationCount: number; dbSizeBytes: number };
  
  /**
   * Close the search index and release resources
   */
  close(): void;
}

/**
 * Create and initialize a search index with default options
 */
export async function createSearchIndex(options?: SearchIndexOptions): Promise<SearchIndex>;
```

### Implementation Details

#### Constructor

The constructor should initialize the components with default options:

```typescript
/**
 * Constructor
 */
constructor(options: SearchIndexOptions = {}) {
  // Set default paths
  this.dbPath = options.dbPath || path.join(process.cwd(), 'data', 'search.db');
  this.researchPath = options.researchPath || path.join(process.cwd(), 'research-archive');
  this.urlContentPath = options.urlContentPath || path.join(process.cwd(), 'url-content-archive');
  
  // Initialize components
  this.db = new SearchDatabase({
    dbPath: this.dbPath,
    createIfNotExists: true
  });
  
  this.scanner = new ArchiveScanner();
  this.contentProcessor = new ContentProcessor();
  this.citationGraph = new CitationGraph(this.db);
  this.searchApi = new SearchAPI({ dbPath: this.dbPath });
  this.indexingTrigger = new IndexingTrigger({
    dbPath: this.dbPath,
    statePath: path.join(path.dirname(this.dbPath), 'indexing-state.json')
  });
  
  // Initialize database if requested
  if (options.initializeDb) {
    this.db.setupSchema();
  }
}
```

#### Initialize Method

The initialize method should set up the system:

```typescript
/**
 * Initialize the search index
 */
async initialize(): Promise<void> {
  try {
    // Ensure database schema is set up
    this.db.setupSchema();
    
    console.log('Search index initialized successfully');
  } catch (error) {
    console.error(`Error initializing search index: ${error.message}`);
    throw new Error(`Failed to initialize search index: ${error.message}`);
  }
}
```

#### Run Indexing Method

The runIndexing method should delegate to the indexing trigger:

```typescript
/**
 * Run indexing job
 */
async runIndexing(options: Partial<IndexingOptions> = {}): Promise<IndexingStats> {
  try {
    // Merge with default options
    const indexingOptions: IndexingOptions = {
      researchPath: options.researchPath || this.researchPath,
      urlContentPath: options.urlContentPath || this.urlContentPath,
      force: options.force || false
    };
    
    // Run indexing
    return await this.indexingTrigger.runIndexing(indexingOptions);
  } catch (error) {
    console.error(`Error running indexing: ${error.message}`);
    throw new Error(`Failed to run indexing: ${error.message}`);
  }
}
```

#### Setup Triggers Method

The setupTriggers method should delegate to the indexing trigger:

```typescript
/**
 * Set up indexing triggers
 */
setupTriggers(options: {
  schedule?: string;
  watchFiles?: boolean;
  watchDirs?: string[];
}): void {
  try {
    // Set up triggers
    this.indexingTrigger.setupTriggers({
      schedule: options.schedule,
      watchFiles: options.watchFiles,
      watchDirs: options.watchDirs || [this.researchPath, this.urlContentPath]
    });
    
    console.log('Indexing triggers set up successfully');
  } catch (error) {
    console.error(`Error setting up triggers: ${error.message}`);
    throw new Error(`Failed to set up triggers: ${error.message}`);
  }
}
```

#### Stop Triggers Method

The stopTriggers method should delegate to the indexing trigger:

```typescript
/**
 * Stop indexing triggers
 */
stopTriggers(): void {
  try {
    this.indexingTrigger.stopTriggers();
    console.log('Indexing triggers stopped');
  } catch (error) {
    console.error(`Error stopping triggers: ${error.message}`);
  }
}
```

#### Search Method

The search method should delegate to the search API:

```typescript
/**
 * Search the index
 */
search(options: SearchOptions): SearchResult[] {
  try {
    return this.searchApi.search(options);
  } catch (error) {
    console.error(`Error searching index: ${error.message}`);
    throw new Error(`Failed to search index: ${error.message}`);
  }
}
```

#### Find Related Method

The findRelated method should delegate to the search API:

```typescript
/**
 * Find documents related to a specific document
 */
findRelated(documentId: string, depth: number = 1): SearchResult[] {
  try {
    return this.searchApi.findRelated(documentId, depth);
  } catch (error) {
    console.error(`Error finding related documents: ${error.message}`);
    throw new Error(`Failed to find related documents: ${error.message}`);
  }
}
```

#### Generate Citation Report Method

The generateCitationReport method should delegate to the search API:

```typescript
/**
 * Generate a citation report for a document
 */
generateCitationReport(documentId: string): any {
  try {
    return this.searchApi.generateCitationReport(documentId);
  } catch (error) {
    console.error(`Error generating citation report: ${error.message}`);
    throw new Error(`Failed to generate citation report: ${error.message}`);
  }
}
```

#### Get Stats Method

The getStats method should delegate to the database:

```typescript
/**
 * Get database statistics
 */
getStats(): { documentCount: number; citationCount: number; dbSizeBytes: number } {
  try {
    return this.db.getStats();
  } catch (error) {
    console.error(`Error getting stats: ${error.message}`);
    throw new Error(`Failed to get stats: ${error.message}`);
  }
}
```

#### Close Method

The close method should clean up resources:

```typescript
/**
 * Close the search index and release resources
 */
close(): void {
  try {
    // Stop any active triggers
    this.stopTriggers();
    
    // Close database connection
    this.db.close();
    
    console.log('Search index closed');
  } catch (error) {
    console.error(`Error closing search index: ${error.message}`);
  }
}
```

#### Create Search Index Function

The createSearchIndex function should provide a convenient way to create and initialize a search index:

```typescript
/**
 * Create and initialize a search index with default options
 */
export async function createSearchIndex(options?: SearchIndexOptions): Promise<SearchIndex> {
  const searchIndex = new SearchIndex(options);
  await searchIndex.initialize();
  return searchIndex;
}
```

### Usage Examples

The module should include usage examples in comments:

```typescript
/**
 * Example usage:
 * 
 * // Create and initialize a search index
 * const searchIndex = await createSearchIndex();
 * 
 * // Run initial indexing
 * await searchIndex.runIndexing();
 * 
 * // Set up scheduled indexing
 * searchIndex.setupTriggers({
 *   schedule: '0 * * * *', // Run every hour
 *   watchFiles: true
 * });
 * 
 * // Search the index
 * const results = searchIndex.search({
 *   query: 'machine learning',
 *   fuzzy: true,
 *   limit: 10
 * });
 * 
 * // Clean up
 * searchIndex.close();
 */
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Overall architecture
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for index module
  - [elements/search_indexing/database_specification.md](database_specification.md) - uses - Index module uses database module
  - [elements/search_indexing/search_api_specification.md](search_api_specification.md) - uses - Index module uses search API
  - [elements/search_indexing/indexing_trigger_specification.md](indexing_trigger_specification.md) - uses - Index module uses indexing trigger

## Navigation Guide
- **When to Use:** When implementing the main entry point for the search indexing system
- **Next Steps:** Implement the index.ts file after all other components
- **Related Tasks:** MCP tool implementation, integration testing

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of index module specification
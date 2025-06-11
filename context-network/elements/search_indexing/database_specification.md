# Database Module Specification

## Purpose
This document provides detailed specifications for the SQLite database module that will serve as the foundation for the search indexing system.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The database module will provide a wrapper around SQLite with FTS5 extensions, implementing the schema defined in the search indexing structure document. It will handle database initialization, connection management, and provide a clean API for other modules to interact with the database.

### File Location

```
src/src/search/database.ts
```

### Dependencies

```typescript
import sqlite3 from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { Document, Citation } from './types';
```

### Interface

```typescript
export interface DatabaseOptions {
  dbPath: string;
  createIfNotExists?: boolean;
}

export class SearchDatabase {
  // Constructor
  constructor(options: DatabaseOptions);
  
  // Initialize database schema
  public setupSchema(): void;
  
  // Document operations
  public addDocument(document: Document): string;
  public getDocument(id: string): Document | null;
  public updateDocument(document: Document): boolean;
  public deleteDocument(id: string): boolean;
  public listDocuments(options?: { source?: string; type?: string; limit?: number }): Document[];
  
  // Full-text search operations
  public searchDocuments(query: string, options?: { 
    fuzzy?: boolean;
    fields?: string[];
    limit?: number;
  }): Array<{ document: Document; score: number; snippets: Array<{ field: string; text: string }> }>;
  
  // Citation operations
  public addCitation(citation: Citation): string;
  public getCitation(id: string): Citation | null;
  public getCitationsForDocument(documentId: string, direction: 'citing' | 'cited'): Citation[];
  public searchCitations(query: string, options?: { limit?: number }): Array<{ citation: Citation; score: number; snippets: string[] }>;
  
  // Transaction support
  public beginTransaction(): void;
  public commitTransaction(): void;
  public rollbackTransaction(): void;
  
  // Utility methods
  public vacuum(): void;
  public getStats(): { documentCount: number; citationCount: number; dbSizeBytes: number };
  public close(): void;
}
```

### Implementation Details

#### Schema Initialization

The `setupSchema` method should implement the schema defined in the search indexing structure document:

```typescript
public setupSchema(): void {
  // Create documents table
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT,
      path TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      metadata TEXT
    );
  `);
  
  // Create FTS5 virtual table for document content
  this.db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS document_content USING fts5(
      id UNINDEXED,
      title,
      content,
      query,
      tokenize='porter unicode61 remove_diacritics 1'
    );
  `);
  
  // Create citations table
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      target_id TEXT,
      context TEXT,
      confidence REAL,
      FOREIGN KEY(source_id) REFERENCES documents(id),
      FOREIGN KEY(target_id) REFERENCES documents(id)
    );
  `);
  
  // Create FTS5 virtual table for citation content
  this.db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS citation_content USING fts5(
      id UNINDEXED,
      context,
      tokenize='porter unicode61 remove_diacritics 1'
    );
  `);
  
  // Create indices for fast lookups
  this.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_id);
    CREATE INDEX IF NOT EXISTS idx_citations_target_id ON citations(target_id);
    CREATE INDEX IF NOT EXISTS idx_citations_target_url ON citations(target_url);
  `);
}
```

#### Document Operations

The document operations should handle both the regular table and the FTS virtual table:

```typescript
public addDocument(document: Document): string {
  const id = document.id || crypto.randomUUID();
  
  // Insert into documents table
  this.db.prepare(`
    INSERT INTO documents (id, title, path, source, type, date, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    document.title,
    document.path,
    document.source,
    document.type,
    document.date,
    JSON.stringify(document.metadata || {})
  );
  
  // Insert into FTS table
  this.db.prepare(`
    INSERT INTO document_content (id, title, content, query)
    VALUES (?, ?, ?, ?)
  `).run(
    id,
    document.title,
    document.content,
    document.query || ''
  );
  
  return id;
}
```

#### Search Operations

The search operations should leverage SQLite's FTS capabilities:

```typescript
public searchDocuments(query: string, options: { 
  fuzzy?: boolean;
  fields?: string[];
  limit?: number;
} = {}): Array<{ document: Document; score: number; snippets: Array<{ field: string; text: string }> }> {
  const { fuzzy = false, fields = ['title', 'content'], limit = 50 } = options;
  
  // Build the query
  const fieldList = fields.join(' OR ');
  const ftsQuery = fuzzy ? query.split(' ').map(term => term + '*').join(' ') : query;
  
  // Execute the search
  const rows = this.db.prepare(`
    SELECT 
      d.id, d.title, d.path, d.source, d.type, d.date, d.metadata,
      dc.content, dc.query,
      snippet(document_content, 0, '<mark>', '</mark>', '...', 10) as title_snippet,
      snippet(document_content, 1, '<mark>', '</mark>', '...', 10) as content_snippet,
      rank
    FROM document_content dc
    JOIN documents d ON dc.id = d.id
    WHERE document_content MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(ftsQuery, limit);
  
  // Process results
  return rows.map(row => ({
    document: {
      id: row.id,
      title: row.title,
      path: row.path,
      source: row.source,
      type: row.type,
      date: row.date,
      metadata: JSON.parse(row.metadata),
      content: row.content,
      query: row.query
    },
    score: row.rank,
    snippets: [
      { field: 'title', text: row.title_snippet },
      { field: 'content', text: row.content_snippet }
    ].filter(snippet => snippet.text !== null)
  }));
}
```

### Error Handling

The module should implement robust error handling:

```typescript
private handleError(operation: string, error: Error): never {
  console.error(`Database error during ${operation}: ${error.message}`);
  throw new Error(`Database error during ${operation}: ${error.message}`);
}
```

### Transaction Support

The module should support transactions for batch operations:

```typescript
public beginTransaction(): void {
  this.db.prepare('BEGIN TRANSACTION').run();
}

public commitTransaction(): void {
  this.db.prepare('COMMIT').run();
}

public rollbackTransaction(): void {
  this.db.prepare('ROLLBACK').run();
}
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Database schema section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for database module

## Navigation Guide
- **When to Use:** When implementing the database module for the search indexing system
- **Next Steps:** Implement the types.ts file, then the database.ts file
- **Related Tasks:** Citation storage, search API implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of database module specification
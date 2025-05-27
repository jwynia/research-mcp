import Database from 'better-sqlite3';
import { Document, Citation } from './types';

export interface DatabaseOptions {
  dbPath: string;
  createIfNotExists?: boolean;
}

export class SearchDatabase {
  private db: Database.Database;

  constructor(options: DatabaseOptions) {
    const { dbPath, createIfNotExists } = options;
    this.db = new Database(dbPath, { verbose: console.log });
    if (createIfNotExists) {
      this.setupSchema();
    }
  }

  public setupSchema(): void {
    // Create documents table for metadata
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
    // Create indices for fast lookups in citations table
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_citations_source ON citations(source_id);
      CREATE INDEX IF NOT EXISTS idx_citations_target_id ON citations(target_id);
      CREATE INDEX IF NOT EXISTS idx_citations_target_url ON citations(target_url);
    `);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return 'doc-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000).toString();
  }

  public addDocument(document: Document): string {
    const id = document.id || this.generateId();
    const insertDocStmt = this.db.prepare(`
      INSERT INTO documents (id, title, path, source, type, date, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertDocStmt.run(
      id,
      document.title,
      document.path,
      document.source,
      document.type,
      document.date,
      JSON.stringify(document.metadata || {})
    );
    const insertFtsStmt = this.db.prepare(`
      INSERT INTO document_content (id, title, content, query)
      VALUES (?, ?, ?, ?)
    `);
    insertFtsStmt.run(
      id,
      document.title,
      document.content,
      document.query || ''
    );
    return id;
  }

  public getDocument(id: string): Document | null {
    const stmt = this.db.prepare(`
      SELECT d.*, dc.content as full_content, dc.query as queryText
      FROM documents d
      JOIN document_content dc ON d.id = dc.id
      WHERE d.id = ?
    `);
    const row = stmt.get(id);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      path: row.path,
      source: row.source,
      type: row.type,
      date: row.date,
      metadata: JSON.parse(row.metadata || '{}'),
      content: row.full_content,
      query: row.queryText
    };
  }

  public updateDocument(document: Document): boolean {
    const stmt = this.db.prepare(`
      UPDATE documents SET title = ?, path = ?, source = ?, type = ?, date = ?, metadata = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      document.title,
      document.path,
      document.source,
      document.type,
      document.date,
      JSON.stringify(document.metadata || {}),
      document.id
    );
    const ftsStmt = this.db.prepare(`
      UPDATE document_content SET title = ?, content = ?, query = ?
      WHERE id = ?
    `);
    ftsStmt.run(
      document.title,
      document.content,
      document.query || '',
      document.id
    );
    return result.changes > 0;
  }

  public deleteDocument(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM documents WHERE id = ?`);
    const result = stmt.run(id);
    const ftsStmt = this.db.prepare(`DELETE FROM document_content WHERE id = ?`);
    ftsStmt.run(id);
    return result.changes > 0;
  }

  /**
   * List all documents in the database
   */
  public listDocuments(): Document[] {
    const stmt = this.db.prepare(`
      SELECT d.*, dc.content as full_content, dc.query as queryText
      FROM documents d
      JOIN document_content dc ON d.id = dc.id
    `);
    const rows = stmt.all();
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      path: row.path,
      source: row.source,
      type: row.type,
      date: row.date,
      metadata: JSON.parse(row.metadata || '{}'),
      content: row.full_content,
      query: row.queryText
    }));
  }

  /**
   * Add a citation to the database
   */
  public addCitation(citation: Citation): string {
    const id = citation.id || 'cit-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000).toString();
    
    const insertCitStmt = this.db.prepare(`
      INSERT INTO citations (id, source_id, target_url, target_id, context, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertCitStmt.run(
      id,
      citation.sourceId,
      citation.targetUrl,
      citation.targetId || null,
      citation.context,
      citation.confidence
    );
    
    // Also add to FTS table for searching citation context
    const insertFtsStmt = this.db.prepare(`
      INSERT INTO citation_content (id, context)
      VALUES (?, ?)
    `);
    
    insertFtsStmt.run(
      id,
      citation.context
    );
    
    return id;
  }

  /**
   * Get citations for a document
   * @param documentId The document ID
   * @param direction 'citing' for documents citing this one, 'cited' for documents cited by this one
   */
  public getCitationsForDocument(documentId: string, direction: 'citing' | 'cited'): Citation[] {
    let stmt;
    
    if (direction === 'citing') {
      // Find documents citing this one (where this is the target)
      stmt = this.db.prepare(`
        SELECT c.*, cc.context as full_context
        FROM citations c
        JOIN citation_content cc ON c.id = cc.id
        WHERE c.target_id = ?
      `);
    } else {
      // Find documents cited by this one (where this is the source)
      stmt = this.db.prepare(`
        SELECT c.*, cc.context as full_context
        FROM citations c
        JOIN citation_content cc ON c.id = cc.id
        WHERE c.source_id = ?
      `);
    }
    
    const rows = stmt.all(documentId);
    
    return rows.map((row: any) => ({
      id: row.id,
      sourceId: row.source_id,
      targetUrl: row.target_url,
      targetId: row.target_id,
      context: row.full_context,
      confidence: row.confidence
    }));
  }

  /**
   * Begin a database transaction
   */
  public beginTransaction(): void {
    this.db.exec('BEGIN TRANSACTION');
  }

  /**
   * Commit a database transaction
   */
  public commitTransaction(): void {
    this.db.exec('COMMIT');
  }

  /**
   * Rollback a database transaction
   */
  public rollbackTransaction(): void {
    this.db.exec('ROLLBACK');
  }

  /**
   * Get database statistics
   */
  public getStats(): { documentCount: number; citationCount: number; dbSizeBytes: number } {
    const documentCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM documents');
    const citationCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM citations');
    
    const documentCount = documentCountStmt.get().count;
    const citationCount = citationCountStmt.get().count;
    
    // Get database file size (this is a simplified implementation)
    const dbSizeBytes = 0; // In a real implementation, we would use fs.statSync(this.dbPath).size
    
    return {
      documentCount,
      citationCount,
      dbSizeBytes
    };
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
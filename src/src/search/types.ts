export interface Document {
  id?: string;
  title: string;
  path: string;
  source: string;
  type: string;
  date: string;
  metadata?: any;
  content: string;
  query?: string;
}

export interface Citation {
  id?: string;
  sourceId: string;
  targetUrl: string;
  targetId?: string;
  context: string;
  confidence: number;
}

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
   * Force reindexing of all documents
   */
  force?: boolean;
}

/**
 * Statistics from an indexing operation
 */
export interface IndexingStats {
  /**
   * Number of documents scanned
   */
  scannedCount: number;
  
  /**
   * Number of documents added
   */
  addedCount: number;
  
  /**
   * Number of documents updated
   */
  updatedCount: number;
  
  /**
   * Number of citations found
   */
  citationCount: number;
  
  /**
   * Time taken in milliseconds
   */
  timeTakenMs: number;
}
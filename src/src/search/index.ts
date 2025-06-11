import path from 'path';
import { SearchDatabase } from './database';
import { ArchiveScanner } from './archiveScanner';
import { ContentProcessor } from './contentProcessor';
import { CitationGraph } from './citationGraph';
import { SearchAPI, SearchOptions, SearchResult, CitationReport } from './searchApi';
import { IndexingTrigger } from './indexingTrigger';
import { IndexingOptions, IndexingStats } from './types';

/**
 * Options for the SearchIndex constructor
 */
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

/**
 * Main search index class that integrates all components
 */
export class SearchIndex {
  private dbPath: string;
  private researchPath: string;
  private urlContentPath: string;
  private db: SearchDatabase;
  private scanner: ArchiveScanner;
  private contentProcessor: ContentProcessor;
  private citationGraph: CitationGraph;
  private searchApi: SearchAPI;
  private indexingTrigger: IndexingTrigger;
  
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
  
  /**
   * Initialize the search index
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database schema is set up
      this.db.setupSchema();
      
      console.log('Search index initialized successfully');
    } catch (error) {
      console.error(`Error initializing search index: ${(error as Error).message}`);
      throw new Error(`Failed to initialize search index: ${(error as Error).message}`);
    }
  }
  
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
      console.error(`Error running indexing: ${(error as Error).message}`);
      throw new Error(`Failed to run indexing: ${(error as Error).message}`);
    }
  }
  
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
      console.error(`Error setting up triggers: ${(error as Error).message}`);
      throw new Error(`Failed to set up triggers: ${(error as Error).message}`);
    }
  }
  
  /**
   * Stop indexing triggers
   */
  stopTriggers(): void {
    try {
      this.indexingTrigger.stopTriggers();
      console.log('Indexing triggers stopped');
    } catch (error) {
      console.error(`Error stopping triggers: ${(error as Error).message}`);
    }
  }
  
  /**
   * Search the index
   */
  search(options: SearchOptions): SearchResult[] {
    try {
      return this.searchApi.search(options);
    } catch (error) {
      console.error(`Error searching index: ${(error as Error).message}`);
      throw new Error(`Failed to search index: ${(error as Error).message}`);
    }
  }
  
  /**
   * Find documents related to a specific document
   */
  findRelated(documentId: string, depth: number = 1): SearchResult[] {
    try {
      return this.searchApi.findRelated(documentId, depth);
    } catch (error) {
      console.error(`Error finding related documents: ${(error as Error).message}`);
      throw new Error(`Failed to find related documents: ${(error as Error).message}`);
    }
  }
  
  /**
   * Generate a citation report for a document
   */
  generateCitationReport(documentId: string): CitationReport {
    try {
      return this.searchApi.generateCitationReport(documentId);
    } catch (error) {
      console.error(`Error generating citation report: ${(error as Error).message}`);
      throw new Error(`Failed to generate citation report: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get database statistics
   */
  getStats(): { documentCount: number; citationCount: number; dbSizeBytes: number } {
    try {
      return this.db.getStats();
    } catch (error) {
      console.error(`Error getting stats: ${(error as Error).message}`);
      throw new Error(`Failed to get stats: ${(error as Error).message}`);
    }
  }
  
  /**
   * Close the search index and release resources
   */
  close(): void {
    try {
      // Stop any active triggers
      this.stopTriggers();
      
      // Close database connection
      // Close the database connection
      this.db.close();
      
      console.log('Search index closed');
    } catch (error) {
      console.error(`Error closing search index: ${(error as Error).message}`);
    }
  }
}

/**
 * Create and initialize a search index with default options
 */
export async function createSearchIndex(options?: SearchIndexOptions): Promise<SearchIndex> {
  const searchIndex = new SearchIndex(options);
  await searchIndex.initialize();
  return searchIndex;
}

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
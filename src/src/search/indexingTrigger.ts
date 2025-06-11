import { ArchiveScanner } from './archiveScanner';
import { ContentProcessor } from './contentProcessor';
import { CitationGraph } from './citationGraph';
import { SearchDatabase } from './database';
import { IndexingOptions, IndexingStats } from './types';
import fs from 'fs-extra';
import path from 'path';
import schedule from 'node-schedule';

/**
 * Options for the IndexingTrigger constructor
 */
export interface IndexingTriggerOptions {
  /**
   * Path to the SQLite database file
   */
  dbPath: string;
  
  /**
   * Path to store indexing state
   */
  statePath?: string;
}

/**
 * Options for scheduling indexing
 */
export interface ScheduleOptions {
  /**
   * Cron expression for scheduled indexing
   */
  schedule?: string;
  
  /**
   * Whether to watch files for changes
   */
  watchFiles?: boolean;
  
  /**
   * Directories to watch for changes
   */
  watchDirs?: string[];
}

/**
 * Indexing Trigger class for scheduling and triggering indexing operations
 */
export class IndexingTrigger {
  private dbPath: string;
  private statePath: string;
  private db: SearchDatabase;
  private scanner: ArchiveScanner;
  private contentProcessor: ContentProcessor;
  private citationGraph: CitationGraph;
  private jobs: schedule.Job[];
  private watchers: fs.FSWatcher[];
  private watchDebounceTimer: NodeJS.Timeout | null;

  /**
   * Constructor
   */
  constructor(options: IndexingTriggerOptions) {
    const { dbPath, statePath } = options;
    
    this.dbPath = dbPath;
    this.statePath = statePath || path.join(path.dirname(dbPath), 'indexing-state.json');
    
    // Initialize components
    this.db = new SearchDatabase({ dbPath, createIfNotExists: true });
    this.scanner = new ArchiveScanner();
    this.contentProcessor = new ContentProcessor();
    this.citationGraph = new CitationGraph(this.db);
    
    // Initialize state
    this.jobs = [];
    this.watchers = [];
    this.watchDebounceTimer = null;
  }

  /**
   * Run indexing job
   */
  async runIndexing(options: IndexingOptions): Promise<IndexingStats> {
    const { researchPath, urlContentPath, force = false } = options;
    
    console.log(`Starting indexing job for research path: ${researchPath} and URL content path: ${urlContentPath}`);
    const startTime = Date.now();
    
    try {
      // Load previous state
      const state = await this.loadState();
      
      // Scan archives
      console.log('Scanning archives...');
      const scanResult = await this.scanner.scan({
        researchPath,
        urlContentPath,
        lastScanTime: force ? undefined : state.lastScanTime,
        force
      });
      
      // Process documents
      console.log(`Processing ${scanResult.documents.length} documents...`);
      const processedDocuments = await this.contentProcessor.processDocuments(scanResult.documents);
      
      // Start database transaction
      this.db.beginTransaction();
      
      try {
        // Add/update documents in the database
        console.log('Updating database...');
        let addedCount = 0;
        let updatedCount = 0;
        
        for (const document of processedDocuments) {
          const existingDoc = this.db.getDocument(document.id!);
          
          if (existingDoc) {
            this.db.updateDocument(document);
            updatedCount++;
          } else {
            this.db.addDocument(document);
            addedCount++;
          }
        }
        
        // Delete removed documents
        console.log(`Deleting ${scanResult.deletedIds.length} documents...`);
        for (const id of scanResult.deletedIds) {
          this.db.deleteDocument(id);
        }
        
        // Build citation graph
        console.log('Building citation graph...');
        const citations = this.citationGraph.buildFromArchives({
          researchPath,
          urlContentPath,
          manageTransaction: false // Don't start a new transaction since we already have one
        });
        
        // Commit transaction
        this.db.commitTransaction();
        
        // Save state
        await this.saveState({ lastScanTime: scanResult.scanTime });
        
        // Calculate stats
        const endTime = Date.now();
        const stats: IndexingStats = {
          scannedCount: scanResult.documents.length,
          addedCount,
          updatedCount,
          citationCount: citations.length,
          timeTakenMs: endTime - startTime
        };
        
        console.log(`Indexing completed in ${stats.timeTakenMs}ms. Added: ${addedCount}, Updated: ${updatedCount}, Citations: ${citations.length}`);
        
        return stats;
      } catch (error) {
        // Rollback on error
        this.db.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error(`Error during indexing: ${(error as Error).message}`);
      throw new Error(`Indexing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Set up indexing triggers
   */
  setupTriggers(options: ScheduleOptions): void {
    const { schedule: cronSchedule, watchFiles = false, watchDirs = [] } = options;
    
    // Stop any existing triggers
    this.stopTriggers();
    
    // Set up scheduled job if provided
    if (cronSchedule) {
      console.log(`Setting up scheduled indexing with cron: ${cronSchedule}`);
      
      const job = schedule.scheduleJob(cronSchedule, async () => {
        try {
          // Get paths from environment or use defaults
          const researchPath = process.env.RESEARCH_ARCHIVE_PATH || path.join(process.cwd(), 'research-archive');
          const urlContentPath = process.env.URL_CONTENT_ARCHIVE_PATH || path.join(process.cwd(), 'url-content-archive');
          
          // Run indexing
          await this.runIndexing({
            researchPath,
            urlContentPath
          });
        } catch (error) {
          console.error(`Scheduled indexing failed: ${(error as Error).message}`);
        }
      });
      
      this.jobs.push(job);
    }
    
    // Set up file watchers if enabled
    if (watchFiles && watchDirs.length > 0) {
      console.log(`Setting up file watchers for directories: ${watchDirs.join(', ')}`);
      
      for (const dir of watchDirs) {
        try {
          // Ensure directory exists
          if (!fs.existsSync(dir)) {
            console.warn(`Watch directory does not exist: ${dir}`);
            continue;
          }
          
          // Create watcher
          const watcher = fs.watch(dir, { recursive: true }, async (eventType, filename) => {
            // Debounce multiple events
            if (this.watchDebounceTimer) {
              clearTimeout(this.watchDebounceTimer);
            }
            
            this.watchDebounceTimer = setTimeout(async () => {
              console.log(`File change detected: ${filename}. Triggering indexing...`);
              
              try {
                // Run indexing
                await this.runIndexing({
                  researchPath: process.env.RESEARCH_ARCHIVE_PATH || path.join(process.cwd(), 'research-archive'),
                  urlContentPath: process.env.URL_CONTENT_ARCHIVE_PATH || path.join(process.cwd(), 'url-content-archive')
                });
              } catch (error) {
                console.error(`Watch-triggered indexing failed: ${(error as Error).message}`);
              }
            }, 5000); // 5-second debounce
          });
          
          this.watchers.push(watcher);
        } catch (error) {
          console.error(`Error setting up watcher for ${dir}: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Stop all triggers
   */
  stopTriggers(): void {
    // Cancel scheduled jobs
    for (const job of this.jobs) {
      job.cancel();
    }
    this.jobs = [];
    
    // Close file watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    
    // Clear debounce timer
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
    
    console.log('All indexing triggers stopped');
  }

  /**
   * Load indexing state
   */
  private async loadState(): Promise<{ lastScanTime?: string }> {
    try {
      // Check if state file exists
      if (await fs.pathExists(this.statePath)) {
        // Read and parse state file
        const stateJson = await fs.readFile(this.statePath, 'utf-8');
        return JSON.parse(stateJson);
      }
    } catch (error) {
      console.warn(`Error loading indexing state: ${(error as Error).message}`);
    }
    
    // Return empty state if file doesn't exist or there's an error
    return {};
  }

  /**
   * Save indexing state
   */
  private async saveState(state: { lastScanTime: string }): Promise<void> {
    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.statePath));
      
      // Write state to file
      await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Error saving indexing state: ${(error as Error).message}`);
    }
  }

  /**
   * Handle errors in a consistent way
   */
  private handleError(operation: string, error: Error): never {
    console.error(`Indexing error during ${operation}: ${error.message}`);
    throw new Error(`Indexing error during ${operation}: ${error.message}`);
  }
}
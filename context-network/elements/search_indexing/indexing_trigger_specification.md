# Indexing Trigger Module Specification

## Purpose
This document provides detailed specifications for the Indexing Trigger module, which is responsible for scheduling and triggering the indexing process.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The Indexing Trigger module provides mechanisms for triggering index updates on a schedule or manually. It coordinates the indexing process by invoking the Archive Scanner, Citation Graph Builder, and other components to update the search index.

### File Location

```
src/src/search/indexingTrigger.ts
```

### Dependencies

```typescript
import { ArchiveScanner } from './archiveScanner';
import { ContentProcessor } from './contentProcessor';
import { CitationGraph } from './citationGraph';
import { SearchDatabase } from './database';
import { IndexingOptions, IndexingStats } from './types';
import fs from 'fs-extra';
import path from 'path';
import schedule from 'node-schedule';
```

### Interface

```typescript
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

export class IndexingTrigger {
  /**
   * Constructor
   */
  constructor(options: IndexingTriggerOptions);
  
  /**
   * Run indexing job
   */
  runIndexing(options: IndexingOptions): Promise<IndexingStats>;
  
  /**
   * Set up indexing triggers
   */
  setupTriggers(options: ScheduleOptions): void;
  
  /**
   * Stop all triggers
   */
  stopTriggers(): void;
  
  /**
   * Load indexing state
   */
  private loadState(): Promise<{ lastScanTime?: string }>;
  
  /**
   * Save indexing state
   */
  private saveState(state: { lastScanTime: string }): Promise<void>;
}
```

### Implementation Details

#### Constructor

The constructor should initialize the necessary components:

```typescript
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
}
```

#### Run Indexing Method

The runIndexing method should orchestrate the indexing process:

```typescript
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
        const existingDoc = this.db.getDocument(document.id);
        
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
      const citations = await this.citationGraph.buildFromArchives({
        researchPath,
        urlContentPath
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
    console.error(`Error during indexing: ${error.message}`);
    throw new Error(`Indexing failed: ${error.message}`);
  }
}
```

#### Setup Triggers Method

The setupTriggers method should configure scheduled indexing:

```typescript
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
        console.error(`Scheduled indexing failed: ${error.message}`);
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
              console.error(`Watch-triggered indexing failed: ${error.message}`);
            }
          }, 5000); // 5-second debounce
        });
        
        this.watchers.push(watcher);
      } catch (error) {
        console.error(`Error setting up watcher for ${dir}: ${error.message}`);
      }
    }
  }
}
```

#### Stop Triggers Method

The stopTriggers method should clean up scheduled jobs and watchers:

```typescript
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
```

#### State Management Methods

The module should include methods for managing indexing state:

```typescript
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
    console.warn(`Error loading indexing state: ${error.message}`);
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
    console.error(`Error saving indexing state: ${error.message}`);
  }
}
```

### Error Handling

The module should implement robust error handling:

```typescript
private handleError(operation: string, error: Error): never {
  console.error(`Indexing error during ${operation}: ${error.message}`);
  throw new Error(`Indexing error during ${operation}: ${error.message}`);
}
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Periodic Indexing System section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for indexing trigger
  - [elements/search_indexing/archive_scanner_specification.md](archive_scanner_specification.md) - uses - Indexing trigger uses archive scanner
  - [elements/search_indexing/database_specification.md](database_specification.md) - uses - Indexing trigger uses database module

## Navigation Guide
- **When to Use:** When implementing the indexing trigger for the search indexing system
- **Next Steps:** Implement the indexingTrigger.ts file after other core components
- **Related Tasks:** Archive scanner implementation, citation graph implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of indexing trigger module specification
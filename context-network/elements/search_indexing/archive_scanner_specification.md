# Archive Scanner Module Specification

## Purpose
This document provides detailed specifications for the Archive Scanner module, which is responsible for scanning the research and URL content archives to identify documents for indexing.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The Archive Scanner module scans the research and URL content archives to identify new, modified, or deleted documents since the last indexing run. It extracts metadata from the documents and prepares them for processing by the content processor and indexer.

### File Location

```
src/src/search/archiveScanner.ts
```

### Dependencies

```typescript
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { Document } from './types';
```

### Interface

```typescript
export interface ScanOptions {
  /**
   * Path to the research archive
   */
  researchPath: string;
  
  /**
   * Path to the URL content archive
   */
  urlContentPath: string;
  
  /**
   * Last scan timestamp (ISO string)
   */
  lastScanTime?: string;
  
  /**
   * Force scan all files regardless of modification time
   */
  force?: boolean;
}

export interface ScanResult {
  /**
   * New or modified documents
   */
  documents: Document[];
  
  /**
   * IDs of deleted documents
   */
  deletedIds: string[];
  
  /**
   * Scan timestamp (ISO string)
   */
  scanTime: string;
}

export class ArchiveScanner {
  /**
   * Scan archives for documents
   */
  scan(options: ScanOptions): Promise<ScanResult>;
  
  /**
   * Scan research archive
   */
  private scanResearchArchive(dirPath: string, lastScanTime?: Date): Promise<Document[]>;
  
  /**
   * Scan URL content archive
   */
  private scanUrlContentArchive(dirPath: string, lastScanTime?: Date): Promise<Document[]>;
  
  /**
   * Extract metadata from research document
   */
  private extractResearchMetadata(filePath: string, content: string): Record<string, any>;
  
  /**
   * Extract metadata from URL content document
   */
  private extractUrlContentMetadata(filePath: string, content: string): Record<string, any>;
  
  /**
   * Generate document ID from file path
   */
  private generateDocumentId(filePath: string, source: string): string;
}
```

### Implementation Details

#### Scan Method

The scan method should orchestrate the scanning of both archives:

```typescript
/**
 * Scan archives for documents
 */
async scan(options: ScanOptions): Promise<ScanResult> {
  const { researchPath, urlContentPath, lastScanTime, force = false } = options;
  
  // Parse last scan time if provided
  const lastScanDate = lastScanTime ? new Date(lastScanTime) : undefined;
  
  // Scan both archives
  const [researchDocuments, urlContentDocuments] = await Promise.all([
    this.scanResearchArchive(researchPath, force ? undefined : lastScanDate),
    this.scanUrlContentArchive(urlContentPath, force ? undefined : lastScanDate)
  ]);
  
  // Combine results
  const documents = [...researchDocuments, ...urlContentDocuments];
  
  // TODO: Implement detection of deleted documents
  // This would require comparing with the previous scan results
  const deletedIds: string[] = [];
  
  return {
    documents,
    deletedIds,
    scanTime: new Date().toISOString()
  };
}
```

#### Scan Research Archive Method

The scanResearchArchive method should scan the research archive:

```typescript
/**
 * Scan research archive
 */
private async scanResearchArchive(dirPath: string, lastScanTime?: Date): Promise<Document[]> {
  const documents: Document[] = [];
  
  // Ensure directory exists
  if (!await fs.pathExists(dirPath)) {
    console.warn(`Research archive directory does not exist: ${dirPath}`);
    return documents;
  }
  
  // Get all files recursively
  const files = await this.getFilesRecursively(dirPath);
  
  // Process each file
  for (const filePath of files) {
    try {
      // Skip non-markdown files
      if (!filePath.endsWith('.md')) continue;
      
      // Check if file was modified since last scan
      if (lastScanTime) {
        const stats = await fs.stat(filePath);
        if (stats.mtime <= lastScanTime) continue;
      }
      
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract metadata
      const metadata = this.extractResearchMetadata(filePath, content);
      
      // Generate document ID
      const id = this.generateDocumentId(filePath, 'research');
      
      // Determine document type
      const type = this.determineResearchDocumentType(filePath, content);
      
      // Extract title
      const title = this.extractTitle(content) || path.basename(filePath, '.md');
      
      // Create document object
      documents.push({
        id,
        title,
        path: path.relative(dirPath, filePath),
        source: 'research',
        type,
        date: this.extractDate(filePath, content) || new Date().toISOString(),
        content,
        query: metadata.query || '',
        metadata
      });
    } catch (error) {
      console.error(`Error processing research file ${filePath}: ${error.message}`);
    }
  }
  
  return documents;
}
```

#### Scan URL Content Archive Method

The scanUrlContentArchive method should scan the URL content archive:

```typescript
/**
 * Scan URL content archive
 */
private async scanUrlContentArchive(dirPath: string, lastScanTime?: Date): Promise<Document[]> {
  const documents: Document[] = [];
  
  // Ensure directory exists
  if (!await fs.pathExists(dirPath)) {
    console.warn(`URL content archive directory does not exist: ${dirPath}`);
    return documents;
  }
  
  // Get all files recursively
  const files = await this.getFilesRecursively(dirPath);
  
  // Process each file
  for (const filePath of files) {
    try {
      // Skip non-markdown files
      if (!filePath.endsWith('.md')) continue;
      
      // Check if file was modified since last scan
      if (lastScanTime) {
        const stats = await fs.stat(filePath);
        if (stats.mtime <= lastScanTime) continue;
      }
      
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract metadata
      const metadata = this.extractUrlContentMetadata(filePath, content);
      
      // Generate document ID
      const id = this.generateDocumentId(filePath, 'url-content');
      
      // Extract title
      const title = this.extractTitle(content) || metadata.title || path.basename(filePath, '.md');
      
      // Create document object
      documents.push({
        id,
        title,
        path: path.relative(dirPath, filePath),
        source: 'url-content',
        type: 'webpage',
        date: metadata.captureDate || new Date().toISOString(),
        content,
        metadata
      });
    } catch (error) {
      console.error(`Error processing URL content file ${filePath}: ${error.message}`);
    }
  }
  
  return documents;
}
```

#### Extract Research Metadata Method

The extractResearchMetadata method should extract metadata from research documents:

```typescript
/**
 * Extract metadata from research document
 */
private extractResearchMetadata(filePath: string, content: string): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  // Extract query from content
  const queryMatch = content.match(/^# Research: (.+?)$/m);
  if (queryMatch) {
    metadata.query = queryMatch[1].trim();
  }
  
  // Extract date from file path
  const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    metadata.date = dateMatch[1];
  }
  
  // Extract source information
  const sourceMatch = content.match(/^## Source: (.+?)$/m);
  if (sourceMatch) {
    metadata.source = sourceMatch[1].trim();
  }
  
  // Extract any YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    try {
      // This is a simplified approach; a proper YAML parser would be better
      const frontmatter = frontmatterMatch[1];
      const lines = frontmatter.split('\n');
      
      for (const line of lines) {
        const [key, value] = line.split(':').map(part => part.trim());
        if (key && value) {
          metadata[key] = value;
        }
      }
    } catch (error) {
      console.warn(`Error parsing frontmatter in ${filePath}: ${error.message}`);
    }
  }
  
  return metadata;
}
```

#### Extract URL Content Metadata Method

The extractUrlContentMetadata method should extract metadata from URL content documents:

```typescript
/**
 * Extract metadata from URL content document
 */
private extractUrlContentMetadata(filePath: string, content: string): Record<string, any> {
  const metadata: Record<string, any> = {};
  
  // Extract original URL from content
  const urlMatch = content.match(/^# Source: \[(.+?)\]\((.+?)\)$/m);
  if (urlMatch) {
    metadata.title = urlMatch[1].trim();
    metadata.originalUrl = urlMatch[2].trim();
  }
  
  // Extract capture date from content
  const dateMatch = content.match(/^## Captured: (.+?)$/m);
  if (dateMatch) {
    metadata.captureDate = dateMatch[1].trim();
  }
  
  // Extract any YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    try {
      // This is a simplified approach; a proper YAML parser would be better
      const frontmatter = frontmatterMatch[1];
      const lines = frontmatter.split('\n');
      
      for (const line of lines) {
        const [key, value] = line.split(':').map(part => part.trim());
        if (key && value) {
          metadata[key] = value;
        }
      }
    } catch (error) {
      console.warn(`Error parsing frontmatter in ${filePath}: ${error.message}`);
    }
  }
  
  return metadata;
}
```

#### Helper Methods

The class should include several helper methods:

```typescript
/**
 * Get all files recursively in a directory
 */
private async getFilesRecursively(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  // Read directory contents
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  
  // Process each entry
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const subFiles = await this.getFilesRecursively(fullPath);
      files.push(...subFiles);
    } else {
      // Add file to list
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Generate document ID from file path
 */
private generateDocumentId(filePath: string, source: string): string {
  // Create a hash of the file path
  const hash = crypto.createHash('md5').update(`${source}:${filePath}`).digest('hex');
  return `${source}-${hash}`;
}

/**
 * Determine research document type
 */
private determineResearchDocumentType(filePath: string, content: string): string {
  // Check for specific patterns in content
  if (content.includes('# Research Report')) {
    return 'report';
  } else if (content.includes('# Search Results')) {
    return 'search';
  }
  
  // Default based on file path
  if (filePath.includes('report')) {
    return 'report';
  } else if (filePath.includes('search')) {
    return 'search';
  }
  
  // Default
  return 'unknown';
}

/**
 * Extract title from content
 */
private extractTitle(content: string): string | null {
  // Look for first heading
  const titleMatch = content.match(/^# (.+?)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract date from file path or content
 */
private extractDate(filePath: string, content: string): string | null {
  // Try to extract from file path
  const pathDateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
  if (pathDateMatch) {
    return pathDateMatch[1];
  }
  
  // Try to extract from content
  const contentDateMatch = content.match(/Date: (\d{4}-\d{2}-\d{2})/);
  if (contentDateMatch) {
    return contentDateMatch[1];
  }
  
  return null;
}
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Archive Scanner section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for archive scanner
  - [elements/search_indexing/types_specification.md](types_specification.md) - uses - Archive scanner uses type definitions

## Navigation Guide
- **When to Use:** When implementing the archive scanner for the search indexing system
- **Next Steps:** Implement the archiveScanner.ts file after types.ts
- **Related Tasks:** Content processor implementation, indexing trigger implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of archive scanner module specification
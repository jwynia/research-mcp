# Content Processor Module Specification

## Purpose
This document provides detailed specifications for the Content Processor module, which is responsible for normalizing and processing document content for indexing.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The Content Processor module prepares document content for indexing by normalizing text, extracting key information, and optimizing for search relevance. It handles different document types and formats to ensure consistent indexing quality.

### File Location

```
src/src/search/contentProcessor.ts
```

### Dependencies

```typescript
import { Document } from './types';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
```

### Interface

```typescript
export class ContentProcessor {
  /**
   * Process a batch of documents
   */
  processDocuments(documents: Document[]): Promise<Document[]>;
  
  /**
   * Process a single document
   */
  processDocument(document: Document): Promise<Document>;
  
  /**
   * Normalize content for indexing
   */
  private normalizeContent(content: string): string;
  
  /**
   * Extract key information from content
   */
  private extractKeyInformation(document: Document): Record<string, any>;
  
  /**
   * Process research document
   */
  private processResearchDocument(document: Document): Promise<Document>;
  
  /**
   * Process URL content document
   */
  private processUrlContentDocument(document: Document): Promise<Document>;
  
  /**
   * Clean HTML content
   */
  private cleanHtml(html: string): string;
  
  /**
   * Convert HTML to Markdown
   */
  private htmlToMarkdown(html: string): string;
}
```

### Implementation Details

#### Process Documents Method

The processDocuments method should handle batch processing:

```typescript
/**
 * Process a batch of documents
 */
async processDocuments(documents: Document[]): Promise<Document[]> {
  // Process documents in parallel with a concurrency limit
  const concurrencyLimit = 5;
  const results: Document[] = [];
  
  // Process in batches to limit concurrency
  for (let i = 0; i < documents.length; i += concurrencyLimit) {
    const batch = documents.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batch.map(doc => this.processDocument(doc)));
    results.push(...batchResults);
  }
  
  return results;
}
```

#### Process Document Method

The processDocument method should handle individual documents:

```typescript
/**
 * Process a single document
 */
async processDocument(document: Document): Promise<Document> {
  try {
    // Clone the document to avoid modifying the original
    const processedDoc = { ...document };
    
    // Process based on source
    if (processedDoc.source === 'research') {
      return await this.processResearchDocument(processedDoc);
    } else if (processedDoc.source === 'url-content') {
      return await this.processUrlContentDocument(processedDoc);
    }
    
    // If unknown source, just normalize the content
    processedDoc.content = this.normalizeContent(processedDoc.content);
    return processedDoc;
  } catch (error) {
    console.error(`Error processing document ${document.id}: ${error.message}`);
    // Return the original document if processing fails
    return document;
  }
}
```

#### Process Research Document Method

The processResearchDocument method should handle research documents:

```typescript
/**
 * Process research document
 */
private async processResearchDocument(document: Document): Promise<Document> {
  // Normalize content
  document.content = this.normalizeContent(document.content);
  
  // Extract key information
  const extractedInfo = this.extractKeyInformation(document);
  
  // Update metadata
  document.metadata = {
    ...document.metadata,
    ...extractedInfo
  };
  
  // Extract query if not already present
  if (!document.query && document.type === 'report') {
    const queryMatch = document.content.match(/^# Research: (.+?)$/m);
    if (queryMatch) {
      document.query = queryMatch[1].trim();
    }
  }
  
  return document;
}
```

#### Process URL Content Document Method

The processUrlContentDocument method should handle URL content documents:

```typescript
/**
 * Process URL content document
 */
private async processUrlContentDocument(document: Document): Promise<Document> {
  // Normalize content
  document.content = this.normalizeContent(document.content);
  
  // Extract key information
  const extractedInfo = this.extractKeyInformation(document);
  
  // Update metadata
  document.metadata = {
    ...document.metadata,
    ...extractedInfo
  };
  
  // Extract original URL if not already in metadata
  if (!document.metadata?.originalUrl) {
    const urlMatch = document.content.match(/^# Source: \[.+?\]\((.+?)\)$/m);
    if (urlMatch) {
      document.metadata = {
        ...document.metadata,
        originalUrl: urlMatch[1].trim()
      };
    }
  }
  
  return document;
}
```

#### Normalize Content Method

The normalizeContent method should standardize content for indexing:

```typescript
/**
 * Normalize content for indexing
 */
private normalizeContent(content: string): string {
  if (!content) return '';
  
  // Remove excessive whitespace
  let normalized = content.replace(/\s+/g, ' ');
  
  // Remove control characters
  normalized = normalized.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize line endings
  normalized = normalized.replace(/\r\n/g, '\n');
  
  // Remove duplicate line breaks
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  
  // Remove HTML comments if any
  normalized = normalized.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove Markdown frontmatter
  normalized = normalized.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  
  return normalized;
}
```

#### Extract Key Information Method

The extractKeyInformation method should extract important data:

```typescript
/**
 * Extract key information from content
 */
private extractKeyInformation(document: Document): Record<string, any> {
  const info: Record<string, any> = {};
  
  // Extract headings
  const headings: string[] = [];
  const headingMatches = document.content.matchAll(/^(#{1,6})\s+(.+?)$/gm);
  for (const match of headingMatches) {
    headings.push(match[2].trim());
  }
  if (headings.length > 0) {
    info.headings = headings;
  }
  
  // Extract links
  const links: Array<{ text: string; url: string }> = [];
  const linkMatches = document.content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of linkMatches) {
    links.push({
      text: match[1].trim(),
      url: match[2].trim()
    });
  }
  if (links.length > 0) {
    info.links = links;
  }
  
  // Extract dates
  const dateMatches = document.content.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
  if (dateMatches) {
    info.dates = Array.from(new Set(dateMatches));
  }
  
  // Extract keywords (simplified approach)
  const keywords = this.extractKeywords(document.content);
  if (keywords.length > 0) {
    info.keywords = keywords;
  }
  
  return info;
}
```

#### Helper Methods

The class should include several helper methods:

```typescript
/**
 * Clean HTML content
 */
private cleanHtml(html: string): string {
  try {
    // Parse HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style');
    for (const script of scripts) {
      script.remove();
    }
    
    // Use Readability to extract main content
    const reader = new Readability(document);
    const article = reader.parse();
    
    return article ? article.content : document.body.innerHTML;
  } catch (error) {
    console.warn(`Error cleaning HTML: ${error.message}`);
    return html;
  }
}

/**
 * Convert HTML to Markdown
 */
private htmlToMarkdown(html: string): string {
  try {
    // Clean HTML first
    const cleanedHtml = this.cleanHtml(html);
    
    // Convert to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Customize turndown rules if needed
    turndownService.addRule('emphasis', {
      filter: ['em', 'i'],
      replacement: (content) => `*${content}*`
    });
    
    return turndownService.turndown(cleanedHtml);
  } catch (error) {
    console.warn(`Error converting HTML to Markdown: ${error.message}`);
    return html;
  }
}

/**
 * Extract keywords from content
 * This is a simplified approach; more sophisticated NLP could be used
 */
private extractKeywords(content: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'of', 'from'
  ]);
  
  // Normalize and tokenize
  const normalized = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = normalized.split(' ');
  
  // Count word frequencies
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    if (word.length < 3 || stopWords.has(word)) continue;
    
    const count = wordCounts.get(word) || 0;
    wordCounts.set(word, count + 1);
  }
  
  // Sort by frequency and take top 20
  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
  
  return sortedWords;
}
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Content Processor section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for content processor
  - [elements/search_indexing/archive_scanner_specification.md](archive_scanner_specification.md) - interfaces-with - Content processor processes documents from archive scanner
  - [elements/search_indexing/types_specification.md](types_specification.md) - uses - Content processor uses type definitions

## Navigation Guide
- **When to Use:** When implementing the content processor for the search indexing system
- **Next Steps:** Implement the contentProcessor.ts file after types.ts
- **Related Tasks:** Archive scanner implementation, database implementation

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of content processor module specification
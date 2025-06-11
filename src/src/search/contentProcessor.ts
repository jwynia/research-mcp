import { Document } from './types';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Content Processor class for normalizing and processing document content for indexing
 */
export class ContentProcessor {
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
      const err = error as Error;
      console.error(`Error processing document ${document.id}: ${err.message}`);
      // Return the original document if processing fails
      return document;
    }
  }
  
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
  
  /**
   * Process URL content document
   */
  private async processUrlContentDocument(document: Document): Promise<Document> {
    // Check if content contains HTML
    if (this.containsHtml(document.content)) {
      // Convert HTML to Markdown
      document.content = this.htmlToMarkdown(document.content);
    }
    
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
    
    // Restore paragraph breaks for readability
    normalized = normalized.replace(/\. /g, '.\n');
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    
    // Remove HTML comments if any
    normalized = normalized.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove Markdown frontmatter
    normalized = normalized.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
    
    return normalized;
  }
  
  /**
   * Extract key information from content
   */
  private extractKeyInformation(document: Document): Record<string, any> {
    const info: Record<string, any> = {};
    
    // Extract headings
    const headings: string[] = [];
    const headingMatches = Array.from(document.content.matchAll(/^(#{1,6})\s+(.+?)$/gm));
    for (const match of headingMatches) {
      headings.push(match[2].trim());
    }
    if (headings.length > 0) {
      info.headings = headings;
    }
    
    // Extract links
    const links: Array<{ text: string; url: string }> = [];
    const linkMatches = Array.from(document.content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g));
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
    
    // Extract keywords
    const keywords = this.extractKeywords(document.content);
    if (keywords.length > 0) {
      info.keywords = keywords;
    }
    
    return info;
  }
  
  /**
   * Check if content contains HTML
   */
  private containsHtml(content: string): boolean {
    // Simple check for HTML tags
    return /<[a-z][\s\S]*>/i.test(content);
  }
  
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
      const err = error as Error;
      console.warn(`Error cleaning HTML: ${err.message}`);
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
      const err = error as Error;
      console.warn(`Error converting HTML to Markdown: ${err.message}`);
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
  
  /**
   * Process plain text content
   */
  private processPlainText(text: string): string {
    // Normalize line endings
    let processed = text.replace(/\r\n/g, '\n');
    
    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Restore paragraph breaks
    processed = processed.replace(/\. /g, '.\n');
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    return processed;
  }
  
  /**
   * Optimize content for search relevance
   * This method enhances content to improve search results
   */
  private optimizeForSearch(document: Document): Document {
    // Clone the document to avoid modifying the original
    const optimized = { ...document };
    
    // Extract important sections based on document type
    if (document.type === 'report') {
      // For reports, emphasize the summary and findings sections
      const summaryMatch = document.content.match(/## Summary\s+([\s\S]*?)(?=##|$)/);
      const findingsMatch = document.content.match(/## Findings\s+([\s\S]*?)(?=##|$)/);
      
      if (summaryMatch || findingsMatch) {
        optimized.metadata = {
          ...optimized.metadata,
          summary: summaryMatch ? summaryMatch[1].trim() : '',
          findings: findingsMatch ? findingsMatch[1].trim() : ''
        };
      }
    } else if (document.type === 'webpage') {
      // For webpages, extract the main content and remove navigation, etc.
      // This is handled by the Readability library in the HTML processing
    }
    
    return optimized;
  }
}
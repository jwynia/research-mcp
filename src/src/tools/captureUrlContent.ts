import { z } from "zod";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
// We'll import pdf-parse dynamically when needed
// This avoids the test file loading issue and works with ES modules
import * as mammoth from "mammoth";


// Simple in-memory rate limiter
const domainRequestTimestamps: Record<string, number[]> = {};
const MAX_REQUESTS_PER_DOMAIN_PER_HOUR = 10; // Default, can be overridden by env var
const REQUEST_DELAY_MS = 2000; // Default delay between requests to same domain

/**
 * Extract the domain from a URL
 */
function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url; // Fallback if URL parsing fails
  }
}

/**
 * Check rate limits for a domain and wait if necessary
 */
async function checkRateLimit(url: string): Promise<void> {
  const domain = getDomainFromUrl(url);
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  
  // Initialize if not exists
  if (!domainRequestTimestamps[domain]) {
    domainRequestTimestamps[domain] = [];
  }
  
  // Clean up old timestamps
  domainRequestTimestamps[domain] = domainRequestTimestamps[domain].filter(
    timestamp => timestamp > oneHourAgo
  );
  
  // Check if rate limit exceeded
  const maxRequests = parseInt(process.env.MAX_REQUESTS_PER_DOMAIN_PER_HOUR || '') || MAX_REQUESTS_PER_DOMAIN_PER_HOUR;
  if (domainRequestTimestamps[domain].length >= maxRequests) {
    throw new Error(`Rate limit exceeded for domain: ${domain}`);
  }
  
  // If there's a recent request, wait before proceeding
  const mostRecentRequest = Math.max(...domainRequestTimestamps[domain], 0);
  const timeSinceLastRequest = now - mostRecentRequest;
  const delay = parseInt(process.env.REQUEST_DELAY_MS || '') || REQUEST_DELAY_MS;
  
  if (mostRecentRequest > 0 && timeSinceLastRequest < delay) {
    await new Promise(resolve => setTimeout(resolve, delay - timeSinceLastRequest));
  }
  
  // Record this request
  domainRequestTimestamps[domain].push(Date.now());
}

/**
 * Process HTML content using Readability and convert to Markdown
 */
async function handleHtml(html: string, url: string) {
  try {
    // Use Readability to extract main content
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article) {
      throw new Error('Failed to extract content from HTML');
    }
    
    // Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Add custom rules for better Markdown conversion
    turndownService.addRule('tables', {
      filter: ['table'],
      replacement: function(content: string, node: Node) {
        // Simple table handling - could be enhanced
        return '\n\n' + content + '\n\n';
      }
    });
    
    const markdown = turndownService.turndown(article.content);
    
    return {
      title: article.title || 'Untitled',
      content: markdown,
      metadata: {
        author: article.byline,
        excerpt: article.excerpt,
        siteName: article.siteName,
        length: markdown.length
      }
    };
  } catch (error: any) {
    console.error('HTML processing error:', error);
    throw new Error(`Failed to process HTML content: ${error.message}`);
  }
}

/**
 * Process PDF content and convert to Markdown
 */
async function handlePdf(buffer: Buffer) {
  try {
    // Dynamically import pdf-parse
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);
    
    // Basic conversion of PDF text to Markdown
    // This is a simple implementation - could be enhanced with better structure detection
    const lines = data.text.split('\n');
    let markdown = '';
    let inParagraph = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        if (inParagraph) {
          markdown += '\n\n';
          inParagraph = false;
        }
      } else {
        // Very basic heuristic for headings - could be improved
        if (trimmedLine.length < 100 && trimmedLine === trimmedLine.toUpperCase()) {
          markdown += `\n\n## ${trimmedLine}\n\n`;
        } else {
          if (!inParagraph) {
            inParagraph = true;
          } else {
            markdown += ' ';
          }
          markdown += trimmedLine;
        }
      }
    }
    
    return {
      title: data.info?.Title || 'Untitled PDF',
      content: markdown,
      metadata: {
        author: data.info?.Author,
        creationDate: data.info?.CreationDate,
        pageCount: data.numpages
      }
    };
  } catch (error: any) {
    console.error('PDF processing error:', error);
    throw new Error(`Failed to process PDF content: ${error.message}`);
  }
}

/**
 * Process DOCX content and convert to Markdown via HTML
 */
async function handleDocx(buffer: Buffer) {
  try {
    // Convert to HTML first (mammoth does this well)
    const result = await mammoth.convertToHtml({ buffer }) as { 
      value: string; 
      messages: Array<{ message: string }> 
    };
    const html = result.value;
    
    // Then convert HTML to Markdown using Turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    const markdown = turndownService.turndown(html);
    
    // Try to extract title from first heading
    let title = 'Untitled Document';
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1];
    }
    
    return {
      title,
      content: markdown,
      metadata: {
        warnings: result.messages.map((msg: { message: string }) => msg.message)
      }
    };
  } catch (error: any) {
    console.error('DOCX processing error:', error);
    throw new Error(`Failed to process DOCX content: ${error.message}`);
  }
}

/**
 * Process plain text content
 */
async function handleTextPlain(text: string) {
  // Try to extract a title from the first line
  const lines = text.split('\n');
  let title = 'Untitled Text';
  let content = text;
  
  if (lines.length > 0 && lines[0].trim()) {
    title = lines[0].trim();
    // Remove the title from content if it's short enough to be a title
    if (title.length < 100) {
      content = lines.slice(1).join('\n').trim();
    }
  }
  
  return {
    title,
    content,
    metadata: {
      length: text.length,
      lineCount: lines.length
    }
  };
}

/**
 * Archive the captured content
 */
async function archiveUrlContent(url: string, data: any, options?: { 
  sourceType?: 'direct_request' | 'research_citation',
  sourceId?: string,
  sourceTopic?: string
}) {
  try {
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const archivePath = path.join(process.env.URL_CONTENT_ARCHIVE_PATH || './url-content-archive', urlHash);
    
    // Create archive directory
    await fs.ensureDir(archivePath);
    
    // Save original content
    await fs.writeFile(path.join(archivePath, 'original'), data.originalContent);
    
    // Save processed content
    await fs.writeFile(path.join(archivePath, 'content.md'), data.processedContent.content);
    
    // Save metadata
    const metadata = {
      url,
      title: data.processedContent.title,
      capturedAt: new Date().toISOString(),
      contentType: data.originalContentType,
      ...data.processedContent.metadata,
      source: options ? {
        type: options.sourceType || 'direct_request',
        id: options.sourceId,
        topic: options.sourceTopic
      } : { type: 'direct_request' }
    };
    
    await fs.writeFile(
      path.join(archivePath, 'metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );
    
    // Update the master index
    const indexPath = path.join(process.env.URL_CONTENT_ARCHIVE_PATH || './url-content-archive', 'index.json');
    let index: any[] = [];
    
    try {
      if (await fs.pathExists(indexPath)) {
        index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading index:', error);
    }
    
    // Add to index if not already present
    if (!index.some(item => item.hash === urlHash)) {
      index.push({
        hash: urlHash,
        url,
        title: data.processedContent.title,
        capturedAt: metadata.capturedAt,
        source: metadata.source
      });
      
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    }
    
    return urlHash;
  } catch (error: any) {
    console.error('Error archiving content:', error);
    throw new Error(`Failed to archive content: ${error.message}`);
  }
}

/**
 * Extract URLs from content
 */
export function extractUrlsFromContent(content: string): string[] {
  // Use a regex to extract URLs from the content
  const urlRegex = /https?:\/\/[^\s"'<>()[\]]+/g;
  const matches = content.match(urlRegex) || [];
  
  // Filter out duplicates
  return [...new Set(matches)];
}

/**
 * Process URLs in background
 */
export async function processUrlsInBackground(urls: string[], sourceId: string, sourceTopic: string) {
  // Process URLs sequentially with rate limiting built into the captureUrlContent tool
  for (const url of urls) {
    try {
      await captureUrlContent.execute({ 
        url, 
        includeMetadata: true,
        _internal: {
          sourceType: 'research_citation',
          sourceId,
          sourceTopic
        }
      });
      console.log(`Background archived citation URL: ${url}`);
    } catch (error) {
      console.error(`Failed to archive citation URL ${url}:`, error);
      // Continue with next URL even if one fails
    }
  }
}

/**
 * The captureUrlContent MCP tool
 */
export const captureUrlContent = {
  name: "captureUrlContent",
  description: "Captures content from a URL and converts it to Markdown format.",
  parameters: z.object({
    url: z.string().url().describe("The URL to capture content from"),
    includeMetadata: z.boolean().optional().describe("Whether to include metadata in the output"),
    _internal: z.object({
      sourceType: z.enum(['direct_request', 'research_citation']),
      sourceId: z.string().optional(),
      sourceTopic: z.string().optional()
    }).optional()
  }),
  async execute(args: { 
    url: string; 
    includeMetadata?: boolean;
    _internal?: {
      sourceType: 'direct_request' | 'research_citation';
      sourceId?: string;
      sourceTopic?: string;
    }
  }) {
    try {
      // Check rate limits
      await checkRateLimit(args.url);
      
      // Fetch content as binary data
      const response = await axios.get(args.url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000 // 10 second timeout
      });
      
      const contentType = response.headers['content-type'] || '';
      let result;
      
      // Process based on content type
      if (contentType.includes('application/pdf')) {
        result = await handlePdf(Buffer.from(response.data));
      } 
      else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        result = await handleDocx(Buffer.from(response.data));
      }
      else if (contentType.includes('text/html')) {
        result = await handleHtml(Buffer.from(response.data).toString(), args.url);
      }
      else if (contentType.includes('text/plain')) {
        result = await handleTextPlain(Buffer.from(response.data).toString());
      }
      else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
      
      // Archive the result
      const urlHash = await archiveUrlContent(args.url, {
        originalContentType: contentType,
        originalContent: response.data,
        processedContent: result
      }, args._internal);
      
      // Return the result
      return args.includeMetadata 
        ? JSON.stringify({ 
            content: result.content, 
            metadata: result.metadata,
            archiveId: urlHash
          }, null, 2)
        : result.content;
    } catch (error: any) {
      console.error('URL content capture error:', error);
      return `Error capturing content from URL: ${args.url}. ${error.message || 'Unknown error'}`;
    }
  }
};

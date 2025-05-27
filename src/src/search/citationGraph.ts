import { SearchDatabase } from './database';
import { Document, Citation } from './types';
import path from 'path';
import fs from 'fs-extra';

/**
 * Citation Graph class for building and querying citation relationships between documents
 */
export class CitationGraph {
  private db: SearchDatabase;

  /**
   * Constructor
   */
  constructor(db: SearchDatabase) {
    this.db = db;
  }

  /**
   * Build citation relationships between documents
   */
  buildFromArchives(options: {
    researchPath: string;
    urlContentPath: string;
    manageTransaction?: boolean;
  }): Citation[] {
    const { researchPath, urlContentPath, manageTransaction = true } = options;
    
    // Get all documents from the database
    const allDocuments = this.db.listDocuments();
    
    // Group documents by source
    const researchDocuments = allDocuments.filter((doc: Document) => doc.source === 'research');
    const urlContentDocuments = allDocuments.filter((doc: Document) => doc.source === 'url-content');
    
    // Start a transaction for batch processing only if we're managing transactions
    if (manageTransaction) {
      this.db.beginTransaction();
    }
    
    try {
      const allCitations: Citation[] = [];
      
      // Process each research document
      for (const document of researchDocuments) {
        // Extract explicit citations
        const explicitCitations = this.extractExplicitCitations(document);
        
        // Match URL references
        const urlReferences = this.matchUrlReferences(document, urlContentDocuments);
        
        // Detect implicit citations (optional, can be resource-intensive)
        const implicitCitations = this.detectImplicitCitations(document, allDocuments);
        
        // Combine all citations
        const documentCitations = [...explicitCitations, ...urlReferences, ...implicitCitations];
        
        // Store citations in the database
        for (const citation of documentCitations) {
          const id = this.db.addCitation(citation);
          citation.id = id;
        }
        
        allCitations.push(...documentCitations);
      }
      
      // Commit the transaction only if we're managing transactions
      if (manageTransaction) {
        this.db.commitTransaction();
      }
      
      return allCitations;
    } catch (error) {
      // Rollback on error only if we're managing transactions
      if (manageTransaction) {
        this.db.rollbackTransaction();
      }
      throw error;
    }
  }

  /**
   * Extract explicit citations from a document
   */
  extractExplicitCitations(document: Document): Citation[] {
    const citations: Citation[] = [];
    
    // Skip if no content
    if (!document.content) {
      return citations;
    }
    
    // Regular expression to find Markdown links
    // This is a simplified version; a more robust parser would be better
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(document.content)) !== null) {
      const [fullMatch, linkText, url] = match;
      
      // Create a citation with context (text surrounding the link)
      const startIndex = Math.max(0, match.index - 100);
      const endIndex = Math.min(document.content.length, match.index + fullMatch.length + 100);
      const context = document.content.substring(startIndex, endIndex);
      
      citations.push({
        sourceId: document.id!,
        targetUrl: url,
        context,
        confidence: 1.0 // Explicit links have maximum confidence
      });
    }
    
    return citations;
  }

  /**
   * Match URLs between research archive and url-content archive
   */
  matchUrlReferences(document: Document, urlContentDocuments: Document[]): Citation[] {
    const citations: Citation[] = [];
    
    // Get all explicit citations
    const explicitCitations = this.extractExplicitCitations(document);
    
    // For each explicit citation, try to find a matching URL content document
    for (const citation of explicitCitations) {
      // Normalize URLs for comparison
      const normalizedTargetUrl = this.normalizeUrl(citation.targetUrl);
      
      // Find matching URL content document
      const matchingDocument = urlContentDocuments.find(doc => {
        // Check metadata for original URL
        const metadata = doc.metadata || {};
        const docUrl = metadata.originalUrl || '';
        return this.normalizeUrl(docUrl) === normalizedTargetUrl;
      });
      
      // If found, update the citation with the document ID
      if (matchingDocument) {
        citation.targetId = matchingDocument.id;
      }
      
      citations.push(citation);
    }
    
    return citations;
  }

  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    try {
      // Remove protocol, trailing slashes, and convert to lowercase
      return url.replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .toLowerCase();
    } catch (error) {
      return url.toLowerCase();
    }
  }

  /**
   * Detect implicit citations through text similarity
   * This is a more advanced feature and could be resource-intensive
   */
  detectImplicitCitations(document: Document, allDocuments: Document[]): Citation[] {
    const citations: Citation[] = [];
    
    // Skip if no content or if the document is not a research report
    if (!document.content || document.source !== 'research' || document.type !== 'report') {
      return citations;
    }
    
    // Get paragraphs from the document
    const paragraphs = this.extractParagraphs(document.content);
    
    // For each paragraph, check similarity with other documents
    for (const paragraph of paragraphs) {
      // Skip short paragraphs
      if (paragraph.length < 100) continue;
      
      // Check against other documents
      for (const otherDoc of allDocuments) {
        // Skip self-comparison
        if (otherDoc.id === document.id) continue;
        
        // Skip if no content
        if (!otherDoc.content) continue;
        
        // Check for significant text overlap
        const similarity = this.calculateTextSimilarity(paragraph, otherDoc.content);
        
        // If similarity is above threshold, create an implicit citation
        if (similarity > 0.7) {
          citations.push({
            sourceId: document.id!,
            targetId: otherDoc.id,
            targetUrl: otherDoc.metadata?.originalUrl || '',
            context: paragraph,
            confidence: similarity
          });
        }
      }
    }
    
    return citations;
  }

  /**
   * Extract paragraphs from text
   */
  private extractParagraphs(text: string): string[] {
    // Split by double newlines (paragraph breaks in Markdown)
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  }

  /**
   * Calculate text similarity between two strings
   * This is a simplified implementation; more sophisticated algorithms could be used
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalized1 = text1.toLowerCase().replace(/\W+/g, ' ').trim();
    const normalized2 = text2.toLowerCase().replace(/\W+/g, ' ').trim();
    
    // Split into words
    const words1 = new Set(normalized1.split(/\s+/));
    const words2 = new Set(normalized2.split(/\s+/));
    
    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Find all documents citing a specific source
   */
  findCitations(documentId: string): Citation[] {
    return this.db.getCitationsForDocument(documentId, 'citing');
  }

  /**
   * Find all sources cited by a document
   */
  findReferences(documentId: string): Citation[] {
    return this.db.getCitationsForDocument(documentId, 'cited');
  }

  /**
   * Find documents related to a specific document through the citation graph
   */
  findRelatedDocuments(documentId: string, depth: number = 1): string[] {
    const visited = new Set<string>();
    const related = new Set<string>();
    
    // Add the starting document
    visited.add(documentId);
    
    // Queue for breadth-first traversal
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: documentId, currentDepth: 0 }
    ];
    
    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;
      
      // Skip if we've reached the maximum depth
      if (currentDepth >= depth) continue;
      
      // Get citations in both directions
      const citing = this.findCitations(id);
      const cited = this.findReferences(id);
      
      // Process citing documents
      for (const citation of citing) {
        if (citation.targetId && !visited.has(citation.targetId)) {
          visited.add(citation.targetId);
          related.add(citation.targetId);
          queue.push({ id: citation.targetId, currentDepth: currentDepth + 1 });
        }
      }
      
      // Process cited documents
      for (const citation of cited) {
        if (!visited.has(citation.sourceId)) {
          visited.add(citation.sourceId);
          related.add(citation.sourceId);
          queue.push({ id: citation.sourceId, currentDepth: currentDepth + 1 });
        }
      }
    }
    
    // Remove the original document from the related set
    related.delete(documentId);
    
    return Array.from(related);
  }

  /**
   * Export citation graph to visualization format
   */
  exportGraph(format: 'json' | 'graphml' | 'dot' = 'json'): string {
    // Get all documents and citations
    const documents = this.db.listDocuments();
    const citations: Citation[] = [];
    
    // Collect all citations
    for (const doc of documents) {
      const citing = this.findCitations(doc.id!);
      citations.push(...citing);
    }
    
    // Export based on format
    switch (format) {
      case 'json':
        return this.exportAsJson(documents, citations);
      case 'graphml':
        return this.exportAsGraphML(documents, citations);
      case 'dot':
        return this.exportAsDot(documents, citations);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as JSON
   */
  private exportAsJson(documents: Document[], citations: Citation[]): string {
    const nodes = documents.map(doc => ({
      id: doc.id,
      label: doc.title,
      type: doc.source,
      metadata: doc.metadata
    }));
    
    const edges = citations.map(citation => ({
      source: citation.sourceId,
      target: citation.targetId || 'external',
      url: citation.targetUrl,
      confidence: citation.confidence
    }));
    
    return JSON.stringify({ nodes, edges }, null, 2);
  }

  /**
   * Export as GraphML
   */
  private exportAsGraphML(documents: Document[], citations: Citation[]): string {
    let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    
    // Define node attributes
    graphml += '  <key id="label" for="node" attr.name="label" attr.type="string"/>\n';
    graphml += '  <key id="type" for="node" attr.name="type" attr.type="string"/>\n';
    
    // Define edge attributes
    graphml += '  <key id="url" for="edge" attr.name="url" attr.type="string"/>\n';
    graphml += '  <key id="confidence" for="edge" attr.name="confidence" attr.type="double"/>\n';
    
    // Start graph
    graphml += '  <graph id="CitationGraph" edgedefault="directed">\n';
    
    // Add nodes
    for (const doc of documents) {
      graphml += `    <node id="${doc.id}">\n`;
      graphml += `      <data key="label">${this.escapeXml(doc.title)}</data>\n`;
      graphml += `      <data key="type">${doc.source}</data>\n`;
      graphml += '    </node>\n';
    }
    
    // Add edges
    for (const citation of citations) {
      if (citation.targetId) {
        graphml += `    <edge source="${citation.sourceId}" target="${citation.targetId}">\n`;
        graphml += `      <data key="url">${this.escapeXml(citation.targetUrl)}</data>\n`;
        graphml += `      <data key="confidence">${citation.confidence}</data>\n`;
        graphml += '    </edge>\n';
      }
    }
    
    // End graph
    graphml += '  </graph>\n';
    graphml += '</graphml>';
    
    return graphml;
  }

  /**
   * Export as DOT (for Graphviz)
   */
  private exportAsDot(documents: Document[], citations: Citation[]): string {
    let dot = 'digraph CitationGraph {\n';
    
    // Add nodes
    for (const doc of documents) {
      dot += `  "${doc.id}" [label="${doc.title.replace(/"/g, '\\"')}", shape=box];\n`;
    }
    
    // Add edges
    for (const citation of citations) {
      if (citation.targetId) {
        dot += `  "${citation.sourceId}" -> "${citation.targetId}" [weight=${citation.confidence}];\n`;
      }
    }
    
    dot += '}\n';
    return dot;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
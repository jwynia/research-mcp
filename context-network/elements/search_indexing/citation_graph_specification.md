# Citation Graph Module Specification

## Purpose
This document provides detailed specifications for the Citation Graph module, which builds and maintains relationships between documents in the search index.

## Classification
- **Domain:** Structure
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content

### Overview

The Citation Graph module is responsible for extracting citations from research reports, matching URLs between the research archive and URL content archive, and detecting implicit citations through text similarity. It provides an API for traversing citation relationships and analyzing citation patterns.

### File Location

```
src/src/search/citationGraph.ts
```

### Dependencies

```typescript
import { SearchDatabase } from './database';
import { Document, Citation } from './types';
import path from 'path';
import fs from 'fs-extra';
```

### Interface

```typescript
export class CitationGraph {
  /**
   * Constructor
   */
  constructor(db: SearchDatabase);
  
  /**
   * Build citation relationships between documents
   */
  buildFromArchives(options: {
    researchPath: string;
    urlContentPath: string;
  }): Citation[];
  
  /**
   * Extract explicit citations from a document
   */
  extractExplicitCitations(document: Document): Citation[];
  
  /**
   * Match URLs between research archive and url-content archive
   */
  matchUrlReferences(document: Document, urlContentDocuments: Document[]): Citation[];
  
  /**
   * Detect implicit citations through text similarity
   */
  detectImplicitCitations(document: Document, allDocuments: Document[]): Citation[];
  
  /**
   * Find all documents citing a specific source
   */
  findCitations(documentId: string): Citation[];
  
  /**
   * Find all sources cited by a document
   */
  findReferences(documentId: string): Citation[];
  
  /**
   * Find documents related to a specific document through the citation graph
   */
  findRelatedDocuments(documentId: string, depth?: number): string[];
  
  /**
   * Export citation graph to visualization format
   */
  exportGraph(format: 'json' | 'graphml' | 'dot'): string;
}
```

### Implementation Details

#### Constructor

The constructor should initialize the database connection:

```typescript
constructor(db: SearchDatabase) {
  this.db = db;
}
```

#### Build From Archives Method

The buildFromArchives method should scan the archives and build the citation graph:

```typescript
/**
 * Build citation relationships between documents
 */
async buildFromArchives(options: {
  researchPath: string;
  urlContentPath: string;
}): Promise<Citation[]> {
  const { researchPath, urlContentPath } = options;
  
  // Get all documents from the database
  const allDocuments = this.db.listDocuments();
  
  // Group documents by source
  const researchDocuments = allDocuments.filter(doc => doc.source === 'research');
  const urlContentDocuments = allDocuments.filter(doc => doc.source === 'url-content');
  
  // Start a transaction for batch processing
  this.db.beginTransaction();
  
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
    
    // Commit the transaction
    this.db.commitTransaction();
    
    return allCitations;
  } catch (error) {
    // Rollback on error
    this.db.rollbackTransaction();
    throw error;
  }
}
```

#### Extract Explicit Citations Method

The extractExplicitCitations method should parse the document content for explicit citations:

```typescript
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
      sourceId: document.id,
      targetUrl: url,
      context,
      confidence: 1.0 // Explicit links have maximum confidence
    });
  }
  
  return citations;
}
```

#### Match URL References Method

The matchUrlReferences method should match URLs between documents:

```typescript
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
```

#### Detect Implicit Citations Method

The detectImplicitCitations method should find similar content:

```typescript
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
          sourceId: document.id,
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
```

#### Find Citations Method

The findCitations method should find documents citing a specific source:

```typescript
/**
 * Find all documents citing a specific source
 */
findCitations(documentId: string): Citation[] {
  return this.db.getCitationsForDocument(documentId, 'citing');
}
```

#### Find References Method

The findReferences method should find sources cited by a document:

```typescript
/**
 * Find all sources cited by a document
 */
findReferences(documentId: string): Citation[] {
  return this.db.getCitationsForDocument(documentId, 'cited');
}
```

#### Find Related Documents Method

The findRelatedDocuments method should traverse the citation graph:

```typescript
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
```

#### Export Graph Method

The exportGraph method should export the citation graph in various formats:

```typescript
/**
 * Export citation graph to visualization format
 */
exportGraph(format: 'json' | 'graphml' | 'dot' = 'json'): string {
  // Get all documents and citations
  const documents = this.db.listDocuments();
  const citations: Citation[] = [];
  
  // Collect all citations
  for (const doc of documents) {
    const citing = this.findCitations(doc.id);
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
  // Implementation for GraphML export
  // This would be a more complex XML-based format
  return ''; // Placeholder
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
```

## Relationships
- **Parent Nodes:** [elements/search_indexing/structure.md](structure.md) - implements - Citation Graph section
- **Child Nodes:** None
- **Related Nodes:** 
  - [planning/search_indexing_implementation_plan.md](../../planning/search_indexing_implementation_plan.md) - details - Implementation plan for citation graph
  - [elements/search_indexing/database_specification.md](database_specification.md) - uses - Citation graph uses database module
  - [elements/search_indexing/types_specification.md](types_specification.md) - uses - Citation graph uses type definitions

## Navigation Guide
- **When to Use:** When implementing the citation graph for the search indexing system
- **Next Steps:** Implement the citationGraph.ts file after database.ts and types.ts
- **Related Tasks:** Search API implementation, citation extraction

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Cline Agent

## Change History
- May 26, 2025: Initial creation of citation graph module specification
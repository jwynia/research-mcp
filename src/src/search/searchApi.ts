import { SearchDatabase } from './database';
import { CitationGraph } from './citationGraph';
import { Document, Citation } from './types';

/**
 * Search options interface
 */
export interface SearchOptions {
  /**
   * The search query
   */
  query: string;
  
  /**
   * Whether to use fuzzy matching
   */
  fuzzy?: boolean;
  
  /**
   * Fields to search in
   */
  fields?: string[];
  
  /**
   * Maximum number of results to return
   */
  limit?: number;
  
  /**
   * Whether to include citation information
   */
  includeCitations?: boolean;
  
  /**
   * Depth of citation traversal
   */
  citationDepth?: number;
}

/**
 * Search match interface
 */
export interface SearchMatch {
  /**
   * The field where the match was found
   */
  field: string;
  
  /**
   * The term that was matched
   */
  term: string;
  
  /**
   * Text snippets containing the match
   */
  snippets: string[];
}

/**
 * Search result interface
 */
export interface SearchResult {
  /**
   * The document that matched the search
   */
  document: {
    id: string;
    title: string;
    path: string;
    source: string;
    date: string;
    score: number;
  };
  
  /**
   * The matches in the document
   */
  matches: SearchMatch[];
  
  /**
   * Citation information
   */
  citations?: {
    citing: Citation[];
    cited: Citation[];
  };
}

/**
 * Citation report interface
 */
export interface CitationReport {
  /**
   * The document ID
   */
  documentId: string;
  
  /**
   * Citation metrics
   */
  metrics: {
    outgoingCount: number;
    incomingCount: number;
    averageConfidence: number;
  };
  
  /**
   * Citation network visualization data
   */
  network: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; confidence: number }>;
  };
}

/**
 * Search API options interface
 */
export interface SearchApiOptions {
  /**
   * Path to the SQLite database file
   */
  dbPath: string;
}

/**
 * Search API class
 */
export class SearchAPI {
  private db: SearchDatabase;
  private citationGraph: CitationGraph;
  
  /**
   * Constructor
   */
  constructor(options: SearchApiOptions) {
    this.db = new SearchDatabase({
      dbPath: options.dbPath,
      createIfNotExists: true
    });
    
    this.citationGraph = new CitationGraph(this.db);
  }
  
  /**
   * Perform a search with citation awareness
   */
  search(options: SearchOptions): SearchResult[] {
    try {
      const { query, fuzzy = false, fields = ['title', 'content', 'query'], limit = 50, includeCitations = false, citationDepth = 1 } = options;
      
      // Perform the basic search
      const results = this.searchDocuments(query, {
        fuzzy,
        fields,
        limit
      });
      
      // Convert to SearchResult format
      const searchResults: SearchResult[] = results.map(result => {
        const searchResult: SearchResult = {
          document: {
            id: result.document.id!,
            title: result.document.title,
            path: result.document.path,
            source: result.document.source,
            date: result.document.date,
            score: result.score
          },
          matches: result.snippets.map(snippet => ({
            field: snippet.field,
            term: query, // This is simplified; in reality, we'd extract the matched terms
            snippets: [snippet.text]
          }))
        };
        
        return searchResult;
      });
      
      // Add citation information if requested
      if (includeCitations) {
        for (const result of searchResults) {
          const documentId = result.document.id;
          
          // Get citations in both directions
          const citing = this.db.getCitationsForDocument(documentId, 'citing');
          const cited = this.db.getCitationsForDocument(documentId, 'cited');
          
          // If citation depth > 1, recursively get more citations
          if (citationDepth > 1) {
            // Implementation for deeper citation traversal would go here
            // This would involve recursively fetching citations up to the specified depth
          }
          
          result.citations = {
            citing,
            cited
          };
        }
      }
      
      return searchResults;
    } catch (error) {
      return this.handleError('search', error);
    }
  }
  
  /**
   * Find documents related to a specific document through the citation graph
   */
  findRelated(documentId: string, depth: number = 1): SearchResult[] {
    try {
      // Get the document to ensure it exists
      const document = this.db.getDocument(documentId);
      if (!document) {
        throw new Error(`Document with ID ${documentId} not found`);
      }
      
      // Get related document IDs through the citation graph
      const relatedIds = this.citationGraph.findRelatedDocuments(documentId, depth);
      
      // Fetch the full documents
      const relatedDocuments = relatedIds
        .map(id => this.db.getDocument(id))
        .filter(Boolean) as Document[];
      
      // Convert to SearchResult format
      return relatedDocuments.map(doc => ({
        document: {
          id: doc.id!,
          title: doc.title,
          path: doc.path,
          source: doc.source,
          date: doc.date,
          score: 1.0 // No relevance score for related documents
        },
        matches: [], // No matches for related documents
        citations: undefined // No citation info by default
      }));
    } catch (error) {
      return this.handleError('findRelated', error);
    }
  }
  
  /**
   * Generate a citation report for a document
   */
  generateCitationReport(documentId: string): CitationReport {
    try {
      // Get the document to ensure it exists
      const document = this.db.getDocument(documentId);
      if (!document) {
        throw new Error(`Document with ID ${documentId} not found`);
      }
      
      // Get citations in both directions
      const citing = this.db.getCitationsForDocument(documentId, 'citing');
      const cited = this.db.getCitationsForDocument(documentId, 'cited');
      
      // Calculate metrics
      const outgoingCount = citing.length;
      const incomingCount = cited.length;
      const allConfidences = [...citing, ...cited].map(citation => citation.confidence);
      const averageConfidence = allConfidences.length > 0
        ? allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length
        : 0;
      
      // Generate network data for visualization
      const network = this.generateCitationVisualization([documentId]);
      
      return {
        documentId,
        metrics: {
          outgoingCount,
          incomingCount,
          averageConfidence
        },
        network
      };
    } catch (error) {
      return this.handleError('generateCitationReport', error);
    }
  }
  
  /**
   * Generate a visualization of the citation network for a set of documents
   */
  generateCitationVisualization(documentIds: string[]): {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; confidence: number }>;
  } {
    try {
      const nodes = new Map();
      const edges = new Map();
      
      // Process each document
      for (const docId of documentIds) {
        // Get the document
        const document = this.db.getDocument(docId);
        if (!document) continue;
        
        // Add the document as a node
        nodes.set(docId, {
          id: docId,
          label: document.title,
          type: 'source'
        });
        
        // Get citations in both directions
        const citing = this.db.getCitationsForDocument(docId, 'citing');
        const cited = this.db.getCitationsForDocument(docId, 'cited');
        
        // Process outgoing citations
        for (const citation of citing) {
          if (citation.targetId) {
            // Add the target document as a node if it's not already there
            if (!nodes.has(citation.targetId)) {
              const targetDoc = this.db.getDocument(citation.targetId);
              if (targetDoc) {
                nodes.set(citation.targetId, {
                  id: citation.targetId,
                  label: targetDoc.title,
                  type: 'target'
                });
              }
            }
            
            // Add the edge
            const edgeKey = `${docId}->${citation.targetId}`;
            edges.set(edgeKey, {
              from: docId,
              to: citation.targetId,
              confidence: citation.confidence
            });
          }
        }
        
        // Process incoming citations
        for (const citation of cited) {
          if (!nodes.has(citation.sourceId)) {
            const sourceDoc = this.db.getDocument(citation.sourceId);
            if (sourceDoc) {
              nodes.set(citation.sourceId, {
                id: citation.sourceId,
                label: sourceDoc.title,
                type: 'source'
              });
            }
          }
          
          // Add the edge
          const edgeKey = `${citation.sourceId}->${docId}`;
          edges.set(edgeKey, {
            from: citation.sourceId,
            to: docId,
            confidence: citation.confidence
          });
        }
      }
      
      // Update node types for documents that are both source and target
      for (const [id, node] of nodes.entries()) {
        let isSource = false;
        let isTarget = false;
        
        for (const edge of edges.values()) {
          if (edge.from === id) isSource = true;
          if (edge.to === id) isTarget = true;
          
          if (isSource && isTarget) {
            node.type = 'both';
            break;
          }
        }
      }
      
      return {
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values())
      };
    } catch (error) {
      return this.handleError('generateCitationVisualization', error);
    }
  }
  
  /**
   * Search documents in the database
   * @private
   */
  private searchDocuments(query: string, options: { fuzzy?: boolean; fields?: string[]; limit?: number }): Array<{
    document: Document;
    score: number;
    snippets: Array<{ field: string; text: string }>;
  }> {
    const { fuzzy = false, fields = ['title', 'content', 'query'], limit = 50 } = options;
    
    // Build the FTS query
    let ftsQuery = query;
    if (fuzzy) {
      // Add fuzzy matching by appending * to each term
      ftsQuery = query.split(/\s+/).map(term => `${term}*`).join(' ');
    }
    
    // Since we don't have direct access to the database for custom queries,
    // we'll implement a simplified search using the available methods
    
    // Get all documents
    const allDocuments = this.db.listDocuments();
    
    // Filter and score documents based on the query
    // This is a simplified implementation that doesn't use FTS capabilities
    const results = allDocuments
      .map(document => {
        // Calculate a simple relevance score
        let score = 0;
        const snippets: Array<{ field: string; text: string }> = [];
        
        // Check each field
        for (const field of fields) {
          if (field === 'title' && document.title) {
            const titleScore = this.calculateFieldScore(document.title, query);
            if (titleScore > 0) {
              score += titleScore * 2; // Title matches are more important
              snippets.push({
                field: 'title',
                text: this.generateSnippet(document.title, query)
              });
            }
          }
          
          if (field === 'content' && document.content) {
            const contentScore = this.calculateFieldScore(document.content, query);
            if (contentScore > 0) {
              score += contentScore;
              snippets.push({
                field: 'content',
                text: this.generateSnippet(document.content, query)
              });
            }
          }
          
          if (field === 'query' && document.query) {
            const queryScore = this.calculateFieldScore(document.query, query);
            if (queryScore > 0) {
              score += queryScore * 1.5; // Query matches are also important
              snippets.push({
                field: 'query',
                text: this.generateSnippet(document.query, query)
              });
            }
          }
        }
        
        return {
          document,
          score,
          snippets
        };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return results;
  }
  
  /**
   * Calculate a relevance score for a field
   * @private
   */
  private calculateFieldScore(text: string, query: string): number {
    if (!text || !query) return 0;
    
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/);
    
    let score = 0;
    for (const term of queryTerms) {
      if (normalizedText.includes(term)) {
        // Add to score based on term frequency
        const regex = new RegExp(term, 'gi');
        const matches = normalizedText.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
    }
    
    return score;
  }
  
  /**
   * Generate a snippet with highlighted query terms
   * @private
   */
  private generateSnippet(text: string, query: string): string {
    if (!text || !query) return '';
    
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/);
    
    // Find the first occurrence of any query term
    let firstIndex = -1;
    for (const term of queryTerms) {
      const index = normalizedText.indexOf(term);
      if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
        firstIndex = index;
      }
    }
    
    if (firstIndex === -1) return text.substring(0, 100);
    
    // Extract a snippet around the first match
    const start = Math.max(0, firstIndex - 50);
    const end = Math.min(text.length, firstIndex + 100);
    let snippet = text.substring(start, end);
    
    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    // Highlight query terms
    for (const term of queryTerms) {
      const regex = new RegExp(`(${term})`, 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    }
    
    return snippet;
  }
  
  /**
   * Process the results
   * @private
   */
  private processSearchResults(rows: any[]): Array<{
    document: Document;
    score: number;
    snippets: Array<{ field: string; text: string }>;
  }> {
    return rows.map((row: any) => {
      // Parse the document
      const document: Document = {
        id: row.id,
        title: row.title,
        path: row.path,
        source: row.source,
        type: row.type,
        date: row.date,
        metadata: JSON.parse(row.metadata || '{}'),
        content: row.content,
        query: row.query
      };
      
      // Extract snippets
      const snippets = row.snippet
        .split('...')
        .filter((s: string) => s.includes('<mark>'))
        .map((s: string) => ({
          field: this.determineMatchField(s, ['title', 'content', 'query']),
          text: s.trim()
        }));
      
      return {
        document,
        score: row.score,
        snippets
      };
    });
  }
  
  /**
   * Determine which field a match is from
   * @private
   */
  private determineMatchField(snippet: string, availableFields: string[]): string {
    // This is a simplified implementation
    // In a real implementation, we would need to track which field each match came from
    
    // For now, just return a default field
    return availableFields[0] || 'content';
  }
  
  /**
   * Handle errors
   * @private
   */
  private handleError(operation: string, error: any): never {
    console.error(`Search API error during ${operation}: ${error.message}`);
    throw new Error(`Search API error during ${operation}: ${error.message}`);
  }
  
}
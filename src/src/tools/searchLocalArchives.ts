import { z } from 'zod';
import path from 'path';
import { SearchAPI, SearchOptions, SearchResult } from '../search/searchApi';

/**
 * Path to the SQLite database file
 * This should be configured based on the environment
 */
const DB_PATH = process.env.SEARCH_DB_PATH || path.join(process.cwd(), 'data', 'search.db');

/**
 * MCP tool for searching local archives
 */
export const searchLocalArchives = {
  name: 'searchLocalArchives',
  description: 'Searches the local research and URL content archives',
  parameters: z.object({
    query: z.string().describe('The search query'),
    fuzzy: z.boolean().describe('Whether to enable fuzzy matching').default(true).optional(),
    includeCitations: z.boolean().describe('Whether to include citation information').default(false).optional(),
    citationDepth: z.number().int().min(1).max(3).describe('How many levels of citations to include').default(1).optional(),
    limit: z.number().int().min(1).max(50).describe('Maximum number of results to return').default(10).optional()
  }),
  async execute(args: { 
    query: string; 
    fuzzy?: boolean; 
    includeCitations?: boolean; 
    citationDepth?: number; 
    limit?: number 
  }) {
    const { query, fuzzy = true, includeCitations = false, citationDepth = 1, limit = 10 } = args;
    
    try {
      // Initialize the search API
      const searchApi = new SearchAPI({
        dbPath: DB_PATH
      });
      
      // Perform the search
      const results = searchApi.search({
        query,
        fuzzy,
        includeCitations,
        citationDepth,
        limit
      });
      
      // Generate citation visualization if citations are included
      let citationGraph = undefined;
      if (includeCitations && results.length > 0) {
        const documentIds = results.map(result => result.document.id);
        citationGraph = searchApi.generateCitationVisualization(documentIds);
      }
      
      // Format the results for the MCP response
      return JSON.stringify({
        results: formatResultsForMCP(results),
        citationGraph,
        metadata: {
          totalResults: results.length,
          query,
          fuzzy,
          includeCitations,
          citationDepth,
          limit
        }
      }, null, 2);
    } catch (error: any) {
      console.error(`Error in searchLocalArchives tool: ${error.message}`);
      return `Failed to search local archives: ${error.message}`;
    }
  }
};

/**
 * Format search results for MCP response
 * This ensures the results are in a format suitable for AI assistants
 */
function formatResultsForMCP(results: SearchResult[]) {
  return results.map(result => ({
    document: {
      id: result.document.id,
      title: result.document.title,
      path: result.document.path,
      source: result.document.source,
      date: result.document.date,
      score: result.document.score
    },
    highlights: result.matches.map(match => ({
      field: match.field,
      snippets: match.snippets
    })),
    citations: result.citations ? {
      citing: result.citations.citing.map(citation => ({
        sourceId: citation.sourceId,
        targetId: citation.targetId,
        targetUrl: citation.targetUrl,
        context: citation.context,
        confidence: citation.confidence
      })),
      cited: result.citations.cited.map(citation => ({
        sourceId: citation.sourceId,
        targetId: citation.targetId,
        targetUrl: citation.targetUrl,
        context: citation.context,
        confidence: citation.confidence
      }))
    } : undefined
  }));
}
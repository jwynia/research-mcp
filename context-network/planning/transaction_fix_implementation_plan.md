# Transaction Fix Implementation Plan

## Purpose
This document provides a detailed implementation plan to fix the nested transaction issue in the search indexing system.

## Classification
- **Domain:** Implementation
- **Stability:** Stable
- **Abstraction:** Technical
- **Confidence:** High

## Content

### Overview

The search indexing system is encountering an error during indexing operations due to nested transactions. This implementation plan outlines the exact code changes needed to fix this issue.

### Required Code Changes

#### 1. Update CitationGraph.buildFromArchives Method

**File:** `src/src/search/citationGraph.ts`

**Changes:**
1. Modify the method signature to accept a `manageTransaction` parameter:

```typescript
buildFromArchives(options: {
  researchPath: string;
  urlContentPath: string;
  manageTransaction?: boolean;
}): Citation[]
```

2. Update the method implementation to conditionally manage transactions:

```typescript
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
```

#### 2. Update IndexingTrigger.runIndexing Method

**File:** `src/src/search/indexingTrigger.ts`

**Changes:**
1. Modify the call to `citationGraph.buildFromArchives()` to pass `manageTransaction: false`:

```typescript
// Build citation graph
console.log('Building citation graph...');
const citations = this.citationGraph.buildFromArchives({
  researchPath,
  urlContentPath,
  manageTransaction: false // Don't start a new transaction since we already have one
});
```

### Testing Plan

1. After implementing these changes, run the indexing process to verify that the error no longer occurs
2. Test both scenarios:
   - Running `CitationGraph.buildFromArchives()` independently (should manage its own transaction)
   - Running it as part of `IndexingTrigger.runIndexing()` (should not start a new transaction)

### Implementation Notes

- The default value for `manageTransaction` is `true` to maintain backward compatibility
- This approach allows the `CitationGraph` class to work both independently and as part of a larger transaction
- No changes to the database schema or API are required

## Relationships
- **Parent Nodes:** [decisions/transaction_management_fix.md] - implements - Transaction management fix decision
- **Related Nodes:** 
  - [elements/search_indexing/citation_graph_specification.md] - modifies - Citation graph implementation
  - [elements/search_indexing/indexing_trigger_specification.md] - modifies - Indexing trigger implementation

## Navigation Guide
- **When to Use:** When implementing the transaction management fix
- **Next Steps:** Switch to Code mode to implement these changes

## Metadata
- **Created:** May 26, 2025
- **Last Updated:** May 26, 2025
- **Updated By:** Architect Agent

## Change History
- May 26, 2025: Initial creation of implementation plan
# Citation Link Implementation

## Purpose
This update documents the implementation of citation links in research reports to ensure proper attribution and traceability.

## Classification
- **Domain:** Content
- **Stability:** Semi-stable
- **Abstraction:** Detailed
- **Confidence:** Established

## Content
The research report tools previously stored citations in the archive JSON files but did not include them in the actual response content returned to consumers. This implementation adds proper markdown citation links to the end of research reports, ensuring that LLM agents and other consumers have access to the source information.

### Implementation Details
1. Modified the `baseResearchReport.ts` file to:
   - Extract citation data from the Perplexity API response
   - Check if a "References" section already exists in the report
   - Append a new "References" section if needed
   - Format each citation as a proper markdown reference link with title and date
   - Append these formatted references to the research report text

### Code Changes
The key code addition was in the `execute` function of the `baseResearchReport.ts` file:

```typescript
// Append citation references if they exist in the data
if (data.citations && data.citations.length > 0 && data.search_results && data.search_results.length > 0) {
  console.log(`Appending ${data.citations.length} citations to the research report`);
  
  // Add a References section if the content doesn't already have one
  if (!result.toLowerCase().includes("## references") && !result.toLowerCase().includes("### references")) {
    result += "\n\n## References\n";
  }
  
  // Create citation reference links in markdown format
  const citationLinks: string[] = [];
  
  // Map each citation URL to its corresponding search result for more detailed references
  data.citations.forEach((url: string, index: number) => {
    const citationNumber = index + 1;
    // Find matching search result for this URL
    const searchResult = data.search_results.find((sr: any) => sr.url === url);
    
    if (searchResult) {
      citationLinks.push(`[${citationNumber}]: ${url} "${searchResult.title}${searchResult.date ? ` (${searchResult.date})` : ''}"`);
    } else {
      // Fallback if no matching search result
      citationLinks.push(`[${citationNumber}]: ${url}`);
    }
  });
  
  // Append the citation links to the result
  if (citationLinks.length > 0) {
    result += "\n\n" + citationLinks.join("\n");
  }
}
```

## Relationships
- **Parent Nodes:** 
  - [Research MCP Project Definition](../../foundation/project_definition.md) - is-child-of - Implements a core feature of the research tools
  - [Content Integration](../../processes/document_integration.md) - implements - Enhances how research is presented to consumers

- **Related Nodes:** 
  - [Search Indexing](../../elements/search_indexing/index.md) - relates-to - The citations that are now included in reports can be indexed

## Navigation Guide
- **When to Use:** When understanding how citation information is included in research reports.
- **Next Steps:** Review client-side code that consumes these research reports to ensure it properly parses and displays the citation links.
- **Related Tasks:** Consider enhancing the formatting of citations or adding more metadata to the citation references.

## Metadata
- **Created:** 2025-06-11
- **Last Updated:** 2025-06-11
- **Updated By:** Cline/Citation Link Implementation Task

## Change History
- 2025-06-11: Initial documentation of citation link implementation

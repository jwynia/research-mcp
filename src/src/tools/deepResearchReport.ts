import { createResearchReportTool } from "./base/baseResearchReport.js";

export const deepResearchReport = createResearchReportTool({
  name: "deepResearchReport",
  description: "Generates a comprehensive research report on a given topic using Perplexity's Sonar Deep Research API (sonar-deep-research model).",
  model: "sonar-deep-research",
  systemPrompt: "Generate a comprehensive, detailed research report with citations, organized sections, and thorough analysis. Ensure all citations are properly formatted and preserved."
});

import { createResearchReportTool } from "./base/baseResearchReport.js";

export const mediumResearchReport = createResearchReportTool({
  name: "mediumResearchReport",
  description: "Generates a moderately detailed research report on a given topic using Perplexity's Sonar Pro model (sonar-pro).",
  model: "sonar-pro",
  systemPrompt: "Provide a well-structured research report with balanced detail, clear sections, and properly formatted citations. Focus on clarity and moderate depth."
});

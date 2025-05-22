import { createResearchReportTool } from "./base/baseResearchReport.js";

export const lightResearchReport = createResearchReportTool({
  name: "lightResearchReport",
  description: "Generates a brief, high-level research summary on a given topic using Perplexity's Sonar model (sonar).",
  model: "sonar",
  systemPrompt: "Provide a concise, high-level research summary with key findings and essential citations. Focus on brevity and clarity."
});

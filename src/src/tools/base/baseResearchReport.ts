import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { extractUrlsFromContent, processUrlsInBackground } from "../captureUrlContent";

// Load environment variables
dotenv.config();

// Helper function to create a hash of the query for archiving
function createQueryHash(topic: string, options: any): string {
  const queryString = JSON.stringify({ topic, options });
  return crypto.createHash('sha256').update(queryString).digest('hex').substring(0, 16);
}

// Helper function to archive a query and its result
async function archiveQueryResult(
  topic: string,
  options: any,
  result: any,
  model: string,
  researchArchivePath: string
): Promise<string> {
  const queryHash = createQueryHash(topic, options);
  const queryDir = path.join(researchArchivePath, "queries", queryHash);

  // Ensure the query directory exists
  await fs.ensureDir(queryDir);

  // Save metadata
  const metadata = {
    topic,
    options,
    timestamp: new Date().toISOString(),
    model,
  };
  await fs.writeJson(path.join(queryDir, "metadata.json"), metadata, { spaces: 2 });

  // Save result
  await fs.writeJson(path.join(queryDir, "result.json"), result, { spaces: 2 });

  // Update index
  const indexPath = path.join(researchArchivePath, "index.json");
  let index = { queries: [] as any[] };

  if (await fs.pathExists(indexPath)) {
    index = await fs.readJson(indexPath);
  }

  // Add to index if not already present
  if (!index.queries.some((q: any) => q.hash === queryHash)) {
    index.queries.push({
      hash: queryHash,
      topic,
      timestamp: metadata.timestamp
    });

    // Sort by timestamp (newest first)
    index.queries.sort((a: any, b: any) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    await fs.writeJson(indexPath, index, { spaces: 2 });
  }

  return queryHash;
}

interface ResearchReportConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  maxTokensEnv?: string;
  temperatureEnv?: string;
  researchArchivePathEnv?: string;
}

export function createResearchReportTool(config: ResearchReportConfig) {
  const {
    name,
    description,
    model,
    systemPrompt,
    maxTokensEnv = "PERPLEXITY_MAX_TOKENS",
    temperatureEnv = "PERPLEXITY_TEMPERATURE",
    researchArchivePathEnv = "RESEARCH_ARCHIVE_PATH"
  } = config;

  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  const PERPLEXITY_MODEL = model;
  const PERPLEXITY_MAX_TOKENS = parseInt(process.env[maxTokensEnv] || "4000");
  const PERPLEXITY_TEMPERATURE = parseFloat(process.env[temperatureEnv] || "0.7");
  const RESEARCH_ARCHIVE_PATH = process.env[researchArchivePathEnv] || "./research-archive";

  // Ensure archive directories exist
  fs.ensureDirSync(path.join(RESEARCH_ARCHIVE_PATH, "queries"));

  return {
    name,
    description,
    parameters: z.object({
      topic: z.string().describe("The research topic to investigate"),
      detailed: z.boolean().optional().describe("Whether to generate a more detailed report"),
      preserveFormatting: z.boolean().optional().describe("Whether to preserve original formatting in the response")
    }),
    async execute(args: { topic: string; detailed?: boolean; preserveFormatting?: boolean }) {
      try {
        if (!PERPLEXITY_API_KEY) {
          throw new Error("PERPLEXITY_API_KEY environment variable is not set");
        }

        console.log(`Generating research report for topic: "${args.topic}" using model: ${PERPLEXITY_MODEL}`);

        const options = {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: PERPLEXITY_MODEL,
            messages: [
              {
                role: "system",
                content: args.detailed
                  ? systemPrompt + " (detailed)"
                  : systemPrompt,
              },
              { role: "user", content: args.topic },
            ],
            max_tokens: PERPLEXITY_MAX_TOKENS,
            temperature: PERPLEXITY_TEMPERATURE,
            top_p: 0.9,
            return_images: false,
            return_related_questions: false,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 1,
          }),
        };

        const response = await fetch(
          "https://api.perplexity.ai/chat/completions",
          options as any
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const result = data.choices[0].message.content;

        console.log(`Generated research report (${result.length} chars)`);

        // Archive the query and result
        const queryHash = await archiveQueryResult(
          args.topic,
          {
            detailed: args.detailed,
            preserveFormatting: args.preserveFormatting
          },
          data,
          PERPLEXITY_MODEL,
          RESEARCH_ARCHIVE_PATH
        );

        console.log(`Archived research report with hash: ${queryHash}`);

        // Extract URLs from the research report and process them in the background
        if (process.env.ARCHIVE_CITATIONS !== 'false') {
          const urls = extractUrlsFromContent(result);
          if (urls.length > 0) {
            console.log(`Found ${urls.length} URLs in research report, processing in background`);
            // Fire and forget - don't await
            processUrlsInBackground(urls, queryHash, args.topic)
              .catch(error => console.error('Background URL processing error:', error));
          }
        }

        return result;
      } catch (err) {
        console.error("Error generating research report:", err);
        throw new Error(`Failed to generate research report: ${(err as Error).message}`);
      }
    }
  };
}

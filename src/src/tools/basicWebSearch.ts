import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Performs a basic web search for a given query string using DuckDuckGo's HTML results page.
 * Returns the top 5 results as an array of { title, snippet, url } objects.
 * Note: This is for low-volume, personal use only. Web scraping may violate search engine terms of service.
 */
export const basicWebSearch = {
  name: "basicWebSearch",
  description: "Performs a basic web search for a given query string.",
  parameters: z.object({
    query: z.string().describe("The search query")
  }),
  async execute(args: { query: string }) {
    try {
      const query = encodeURIComponent(args.query);
      const response = await axios.get(`https://html.duckduckgo.com/html/?q=${query}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      const $ = cheerio.load(response.data);
      const results: { title: string; snippet: string; url: string }[] = [];

      $('.result').each((i: number, el: any) => {
        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();
        const url = $(el).find('.result__url').attr('href');
        if (title && url) {
          results.push({ title, snippet, url });
        }
      });

      return JSON.stringify(results.slice(0, 5), null, 2);
    } catch (error: any) {
      console.error('Search error:', error);
      return `Error performing search for: ${args.query}. ${error.message}`;
    }
  }
};

/**
 * Tavily Crawl Tool - Graph-based website exploration
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { logger } from '../config/index.js';
import { getTavilyApiKey } from './tavily-common.js';

/**
 * Tavily Crawl API response type
 */
interface TavilyCrawlResponse {
  base_url: string;
  results: Array<{
    url: string;
    raw_content: string;
    images?: Array<{
      url: string;
      description?: string;
    }>;
    favicon?: string;
  }>;
  response_time: number;
  usage?: {
    credits: number;
  };
  request_id?: string;
}

/**
 * Tavily API error type
 */
interface TavilyError {
  error: string;
  message: string;
  status?: number;
}

/**
 * Truncate content to safe size
 */
function truncateContent(content: string, maxLength: number = 2500): string {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  return `${truncated}... (Content truncated due to length. Original length: ${content.length} characters)`;
}

/**
 * Call Tavily Crawl API
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callTavilyCrawlAPI(params: Record<string, any>): Promise<TavilyCrawlResponse> {
  const apiKey = await getTavilyApiKey();

  const response = await fetch('https://api.tavily.com/crawl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMessage = `Tavily Crawl API error: ${response.status} ${response.statusText}`;

    try {
      const errorData = (await response.json()) as TavilyError;
      errorMessage = `Tavily Crawl API error: ${errorData.error} - ${errorData.message}`;
    } catch {
      // Use default error message for JSON parse errors
    }

    throw new Error(errorMessage);
  }

  const data = (await response.json()) as TavilyCrawlResponse;
  return data;
}

/**
 * Format crawl results
 */
function formatCrawlResults(response: TavilyCrawlResponse): string {
  const { base_url, results, response_time, usage } = response;

  let output = `🕷️ Tavily Crawl Results\n`;
  output += `Base URL: ${base_url}\n`;
  output += `Processing Time: ${response_time}s\n`;
  output += `Pages Discovered: ${results.length} items\n`;

  if (usage?.credits) {
    output += `Credits Used: ${usage.credits}\n`;
  }

  output += `\n`;

  // Crawl results
  if (results.length > 0) {
    output += `📄 Crawled Pages:\n\n`;

    results.forEach((result, index) => {
      output += `${index + 1}. **${result.url}**\n`;
      output += `Content:\n${truncateContent(result.raw_content, 1500)}\n`;

      // If images exist
      if (result.images && result.images.length > 0) {
        output += `🖼️ Images (${result.images.length} items):\n`;
        result.images.slice(0, 2).forEach((image, imgIndex) => {
          output += `  ${imgIndex + 1}. ${image.url}`;
          if (image.description) {
            output += ` - ${image.description}`;
          }
          output += `\n`;
        });
      }

      output += `\n`;
    });
  }

  return output.trim();
}

/**
 * Tavily Crawl Tool
 */
export const tavilyCrawlTool = tool({
  name: 'tavily_crawl',
  description:
    'Comprehensively crawl websites using Tavily API. Starting from specified root URL, automatically discovers and extracts related pages.',
  inputSchema: z.object({
    url: z.string().describe('Starting URL for crawl'),
    instructions: z
      .string()
      .optional()
      .describe('Crawl instructions (natural language). Specifying doubles the usage cost'),
    maxDepth: z
      .number()
      .min(1)
      .max(5)
      .default(1)
      .describe('Maximum exploration depth (1-5, how far from base URL)'),
    maxBreadth: z
      .number()
      .min(1)
      .default(20)
      .describe('Maximum number of links per page (1 or more)'),
    limit: z.number().min(1).default(50).describe('Maximum number of links to process (1 or more)'),
    selectPaths: z
      .array(z.string())
      .optional()
      .describe('Regex patterns for paths to include (e.g., ["/docs/.*", "/api/v1.*"])'),
    selectDomains: z
      .array(z.string())
      .optional()
      .describe('Regex patterns for domains to include (e.g., ["^docs\\.example\\.com$"])'),
    excludePaths: z
      .array(z.string())
      .optional()
      .describe('Regex patterns for paths to exclude (e.g., ["/private/.*", "/admin/.*"])'),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe('Regex patterns for domains to exclude (e.g., ["^private\\.example\\.com$"])'),
    allowExternal: z
      .boolean()
      .default(true)
      .describe('Whether to include external domain links in results'),
    extractDepth: z
      .enum(['basic', 'advanced'])
      .default('basic')
      .describe(
        'Extraction depth. basic: 1 credit/5 extractions, advanced: 2 credits/5 extractions'
      ),
    format: z
      .enum(['markdown', 'text'])
      .default('markdown')
      .describe('Output format. markdown or text'),
    includeImages: z.boolean().default(false).describe('Whether to include image information'),
    chunksPerSource: z
      .number()
      .min(1)
      .max(5)
      .default(3)
      .describe('Number of chunks per source (1-5, only effective when instructions is specified)'),
    timeout: z.number().min(10).max(150).default(150).describe('Timeout in seconds (10-150)'),
  }),
  callback: async (input) => {
    const {
      url,
      instructions,
      maxDepth,
      maxBreadth,
      limit,
      selectPaths,
      selectDomains,
      excludePaths,
      excludeDomains,
      allowExternal,
      extractDepth,
      format,
      includeImages,
      chunksPerSource,
      timeout,
    } = input;

    logger.info(`🕷️ Tavily crawl started: ${url}`);

    try {
      // Build API parameters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiParams: Record<string, any> = {
        url,
        max_depth: maxDepth,
        max_breadth: maxBreadth,
        limit,
        allow_external: allowExternal,
        extract_depth: extractDepth,
        format,
        include_images: includeImages,
        timeout,
      };

      // Set optional parameters
      if (instructions) {
        apiParams.instructions = instructions;
        apiParams.chunks_per_source = chunksPerSource;
      }

      if (selectPaths && selectPaths.length > 0) {
        apiParams.select_paths = selectPaths;
      }

      if (selectDomains && selectDomains.length > 0) {
        apiParams.select_domains = selectDomains;
      }

      if (excludePaths && excludePaths.length > 0) {
        apiParams.exclude_paths = excludePaths;
      }

      if (excludeDomains && excludeDomains.length > 0) {
        apiParams.exclude_domains = excludeDomains;
      }

      // Call Tavily Crawl API
      const startTime = Date.now();
      const response = await callTavilyCrawlAPI(apiParams);
      const duration = Date.now() - startTime;

      // Format results
      const formattedResult = formatCrawlResults(response);

      logger.info(
        `✅ Tavily crawl completed: ${response.results.length} pages discovered (${duration}ms)`
      );

      return formattedResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Tavily crawl error: ${url}`, errorMessage);

      return `❌ An error occurred during Tavily crawl
Target URL: ${url}
Error: ${errorMessage}

Troubleshooting:
1. Verify that TAVILY_API_KEY environment variable is correctly set
2. Check internet connection
3. Verify URL is valid
4. Verify crawl settings (depth, limits) are appropriate
5. Check if API usage limit has been reached`;
    }
  },
});

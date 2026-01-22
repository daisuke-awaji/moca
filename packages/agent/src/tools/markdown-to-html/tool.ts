/**
 * Markdown to HTML Tool - Convert Markdown files to styled HTML reports
 */

import { tool } from '@strands-agents/sdk';
import { markdownToHtmlDefinition } from '@fullstack-agentcore/tool-definitions';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, basename, extname, join } from 'path';
import { logger } from '../../config/index.js';
import { getCurrentContext } from '../../context/request-context.js';
import { convertMarkdownToHtml } from './converter.js';
import { replaceWithPresignedUrls } from './presigned-url.js';

/**
 * Generate default output path with timestamp
 */
function generateDefaultOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').slice(0, 15);
  return join(dir, `report-${timestamp}.html`);
}

/**
 * Extract title from filename
 */
function getTitleFromFilename(inputPath: string): string {
  const filename = basename(inputPath, extname(inputPath));
  // Convert kebab-case or snake_case to title case
  return filename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Markdown to HTML Tool
 */
export const markdownToHtmlTool = tool({
  name: markdownToHtmlDefinition.name,
  description: markdownToHtmlDefinition.description,
  inputSchema: markdownToHtmlDefinition.zodSchema,
  callback: async (input) => {
    const {
      inputPath,
      title,
      outputPath,
      embedMedia = 'relative',
      presignedUrlExpiry = 86400,
    } = input;

    logger.info(`📄 Markdown to HTML conversion started: ${inputPath}`);
    logger.info(`📄 embedMedia: ${embedMedia}, presignedUrlExpiry: ${presignedUrlExpiry}s`);

    try {
      // Wait for workspace sync to complete
      const context = getCurrentContext();
      if (context?.workspaceSync) {
        await context.workspaceSync.waitForInitialSync();
      }

      // Check if input file exists
      if (!existsSync(inputPath)) {
        const msg = `Input file does not exist: ${inputPath}`;
        logger.warn(`⚠️ ${msg}`);
        return JSON.stringify({
          success: false,
          outputPath: '',
          message: msg,
        });
      }

      // Read Markdown file
      const markdownContent = readFileSync(inputPath, 'utf8');

      if (!markdownContent.trim()) {
        const msg = `Input file is empty: ${inputPath}`;
        logger.warn(`⚠️ ${msg}`);
        return JSON.stringify({
          success: false,
          outputPath: '',
          message: msg,
        });
      }

      // Determine title
      const documentTitle = title || getTitleFromFilename(inputPath);

      // Determine output path
      const finalOutputPath = outputPath || generateDefaultOutputPath(inputPath);

      // Ensure output directory exists
      const outputDir = dirname(finalOutputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Convert Markdown to HTML
      let htmlContent = convertMarkdownToHtml(markdownContent, documentTitle);

      // Process media URLs if embedMedia is 'presigned'
      if (embedMedia === 'presigned') {
        logger.info('🔗 Converting media paths to presigned URLs...');
        htmlContent = await replaceWithPresignedUrls(htmlContent, presignedUrlExpiry);
      }

      // Write HTML file
      writeFileSync(finalOutputPath, htmlContent, 'utf8');

      const expiryInfo =
        embedMedia === 'presigned'
          ? ` Media URLs are valid for ${Math.floor(presignedUrlExpiry / 3600)} hour(s).`
          : '';

      logger.info(`✅ Successfully converted Markdown to HTML: ${finalOutputPath}`);

      return JSON.stringify({
        success: true,
        outputPath: finalOutputPath,
        embedMedia,
        message: `Successfully converted Markdown to HTML. Output saved to: ${finalOutputPath}${expiryInfo}`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Markdown to HTML conversion error: ${inputPath}`, errorMsg);
      return JSON.stringify({
        success: false,
        outputPath: '',
        message: `Error converting Markdown to HTML: ${errorMsg}`,
      });
    }
  },
});

/**
 * Input content builder for multimodal agent input
 */

import { TextBlock, ImageBlock } from '@strands-agents/sdk';
import type { ContentBlock } from '@strands-agents/sdk';
import type { ImageData } from '../validation/index.js';
import { logger } from '../config/index.js';

/**
 * Build input content blocks for agent (text + images for multimodal)
 * @param prompt Text prompt
 * @param images Optional array of images
 * @returns ContentBlock array if multimodal, or prompt string if text-only
 */
export function buildInputContent(prompt: string, images?: ImageData[]): ContentBlock[] | string {
  // Text-only input (no images)
  if (!images || images.length === 0) {
    return prompt;
  }

  const inputContent: ContentBlock[] = [];

  // Add text content if present
  if (prompt.trim()) {
    inputContent.push(new TextBlock(prompt));
  }

  // Add image content blocks for multimodal input
  for (const image of images) {
    // Convert base64 string to Uint8Array
    const binaryString = Buffer.from(image.base64, 'base64');
    const bytes = new Uint8Array(binaryString);

    // Map mimeType to format
    const formatMap: Record<string, 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp'> = {
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const format = formatMap[image.mimeType] || 'png';

    inputContent.push(
      new ImageBlock({
        format,
        source: { bytes },
      })
    );
  }

  logger.info(`🖼️ Added ${images.length} image(s) to input`);

  return inputContent;
}

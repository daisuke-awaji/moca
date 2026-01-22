/**
 * Tests for presigned URL utilities
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';

// Mock dependencies
const mockGetCurrentContext = jest.fn() as Mock<() => { userId: string } | null>;
const mockGetCurrentStoragePath = jest.fn() as Mock<() => string | null>;
const mockGetSignedUrl = jest.fn() as Mock<() => Promise<string>>;

jest.unstable_mockModule('../../../context/request-context.js', () => ({
  getCurrentContext: mockGetCurrentContext,
  getCurrentStoragePath: mockGetCurrentStoragePath,
}));

jest.unstable_mockModule('../../../config/index.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn(),
}));

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Dynamic import after mocking
const { replaceWithPresignedUrls } = await import('../presigned-url.js');

describe('presigned-url utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.USER_STORAGE_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
  });

  describe('replaceWithPresignedUrls', () => {
    it('should return original HTML when no storage path is available', async () => {
      mockGetCurrentStoragePath.mockReturnValue(null);

      const html = '<img src="/test/image.png">';
      const result = await replaceWithPresignedUrls(html);

      expect(result).toBe(html);
    });

    it('should return original HTML when no media paths are found', async () => {
      mockGetCurrentStoragePath.mockReturnValue('/storage');

      const html = '<p>No images here</p>';
      const result = await replaceWithPresignedUrls(html);

      expect(result).toBe(html);
    });

    it('should replace storage paths with presigned URLs', async () => {
      mockGetCurrentStoragePath.mockReturnValue('/JAWS-UG/agent-browser');
      mockGetCurrentContext.mockReturnValue({ userId: 'test-user' });
      mockGetSignedUrl.mockResolvedValue('https://presigned-url.example.com/image.png');

      const html = '<img src="/JAWS-UG/agent-browser/images/test.png" alt="Test">';
      const result = await replaceWithPresignedUrls(html);

      expect(result).toContain('https://presigned-url.example.com/image.png');
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('should handle multiple media paths', async () => {
      mockGetCurrentStoragePath.mockReturnValue('/storage');
      mockGetCurrentContext.mockReturnValue({ userId: 'test-user' });
      mockGetSignedUrl
        .mockResolvedValueOnce('https://presigned-url.example.com/image1.png')
        .mockResolvedValueOnce('https://presigned-url.example.com/video.mp4');

      const html = `
        <img src="/storage/image1.png">
        <video><source src="/storage/video.mp4"></video>
      `;
      const result = await replaceWithPresignedUrls(html);

      expect(result).toContain('https://presigned-url.example.com/image1.png');
      expect(result).toContain('https://presigned-url.example.com/video.mp4');
    });

    it('should not replace non-storage paths', async () => {
      mockGetCurrentStoragePath.mockReturnValue('/storage');
      mockGetCurrentContext.mockReturnValue({ userId: 'test-user' });

      const html = '<img src="https://external.com/image.png">';
      const result = await replaceWithPresignedUrls(html);

      expect(result).toBe(html);
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('should handle presigned URL generation failure gracefully', async () => {
      mockGetCurrentStoragePath.mockReturnValue('/storage');
      mockGetCurrentContext.mockReturnValue({ userId: 'test-user' });
      mockGetSignedUrl.mockRejectedValue(new Error('S3 error'));

      const html = '<img src="/storage/image.png">';
      const result = await replaceWithPresignedUrls(html);

      // Should keep original path when presigned URL generation fails
      expect(result).toContain('/storage/image.png');
    });
  });
});

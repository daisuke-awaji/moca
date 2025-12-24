/**
 * Storage Routes
 * ユーザーファイルストレージのAPI
 */

import { Router, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import * as storageService from '../services/s3-storage.js';

const router = Router();

// 全ルートにJWT認証を適用
router.use(jwtAuthMiddleware);

/**
 * GET /storage/list
 * ディレクトリ内のファイル・フォルダ一覧を取得
 */
router.get('/list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const path = (req.query.path as string) || '/';

    const result = await storageService.listStorageItems(userId, path);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Storage list error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to list storage items',
    });
  }
});

/**
 * POST /storage/upload
 * ファイルアップロード用の署名付きURLを生成
 */
router.post('/upload', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const { fileName, path, contentType } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'Bad Request', message: 'fileName is required' });
    }

    const result = await storageService.generateUploadUrl(userId, fileName, path, contentType);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Storage upload URL generation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to generate upload URL',
    });
  }
});

/**
 * POST /storage/directory
 * 新しいディレクトリを作成
 */
router.post('/directory', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const { directoryName, path } = req.body;

    if (!directoryName) {
      return res.status(400).json({ error: 'Bad Request', message: 'directoryName is required' });
    }

    const result = await storageService.createDirectory(userId, directoryName, path);

    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Storage directory creation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create directory',
    });
  }
});

/**
 * DELETE /storage/file
 * ファイルを削除
 */
router.delete('/file', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const path = req.query.path as string;

    if (!path) {
      return res.status(400).json({ error: 'Bad Request', message: 'path is required' });
    }

    const result = await storageService.deleteFile(userId, path);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Storage file deletion error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to delete file',
    });
  }
});

/**
 * DELETE /storage/directory
 * ディレクトリを削除
 * クエリパラメータ force=true で、ディレクトリ内のすべてのファイルを含めて削除
 */
router.delete('/directory', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const path = req.query.path as string;
    const force = req.query.force === 'true';

    if (!path) {
      return res.status(400).json({ error: 'Bad Request', message: 'path is required' });
    }

    const result = await storageService.deleteDirectory(userId, path, force);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Storage directory deletion error:', error);

    if (error instanceof Error && error.message === 'Directory is not empty') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Directory is not empty',
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to delete directory',
    });
  }
});

/**
 * GET /storage/download
 * ファイルダウンロード用の署名付きURLを生成
 */
router.get('/download', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const path = req.query.path as string;

    if (!path) {
      return res.status(400).json({ error: 'Bad Request', message: 'path is required' });
    }

    const downloadUrl = await storageService.generateDownloadUrl(userId, path);

    res.status(200).json({ downloadUrl });
  } catch (error) {
    console.error('❌ Storage download URL generation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to generate download URL',
    });
  }
});

/**
 * GET /storage/tree
 * フォルダツリー構造を取得
 */
router.get('/tree', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    const tree = await storageService.getFolderTree(userId);

    res.status(200).json({ tree });
  } catch (error) {
    console.error('❌ Storage tree generation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to generate folder tree',
    });
  }
});

export default router;

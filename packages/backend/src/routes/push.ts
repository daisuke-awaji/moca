/**
 * Push Notification Routes
 * API for managing Web Push notification subscriptions
 */

import { Router, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { createPushSubscriptionsService } from '../services/push-subscriptions-service.js';

const router = Router();

// Apply JWT authentication to all routes
router.use(jwtAuthMiddleware);

const service = createPushSubscriptionsService();

/**
 * POST /push/subscribe
 * Save a push subscription for the current user
 */
router.post('/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    if (!service) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Push notifications not configured',
      });
    }

    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'endpoint and keys (p256dh, auth) are required',
      });
    }

    const userAgent = req.get('User-Agent');

    await service.saveSubscription(userId, { endpoint, keys, userAgent });

    console.log(`🔔 Push subscription saved for user: ${userId}`);
    res.status(201).json({ message: 'Subscription saved' });
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * DELETE /push/subscribe
 * Remove a push subscription for the current user
 */
router.delete('/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    if (!service) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Push notifications not configured',
      });
    }

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'endpoint is required',
      });
    }

    await service.deleteSubscription(userId, endpoint);

    console.log(`🔕 Push subscription removed for user: ${userId}`);
    res.status(200).json({ message: 'Subscription removed' });
  } catch (error) {
    console.error('Failed to delete push subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /push/status
 * Get push subscription status for the current user
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User ID not found' });
    }

    if (!service) {
      return res.status(200).json({ configured: false, subscriptionCount: 0 });
    }

    const subscriptionCount = await service.getSubscriptionCount(userId);

    res.status(200).json({ configured: true, subscriptionCount });
  } catch (error) {
    console.error('Failed to get push status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

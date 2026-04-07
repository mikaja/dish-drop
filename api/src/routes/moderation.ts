// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const reportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().min(1),
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'nudity', 'violence', 'other']),
  description: z.string().max(500).optional(),
});

// POST /moderation/reports - Create a report
router.post('/reports', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = reportSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { targetType, targetId, reason, description } = validation.data;
    const reporterId = req.user!.userId;

    // Prevent self-reporting
    if (targetType === 'user' && targetId === reporterId) {
      res.status(400).json({ error: 'You cannot report yourself' });
      return;
    }

    // Check for duplicate report
    const existing = await prisma.report.findFirst({
      where: { reporterId, targetType, targetId },
    });
    if (existing) {
      res.status(409).json({ error: 'You have already reported this content' });
      return;
    }

    // Validate target exists
    if (targetType === 'post') {
      const post = await prisma.post.findUnique({ where: { id: targetId } });
      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
    } else if (targetType === 'comment') {
      const comment = await prisma.comment.findUnique({ where: { id: targetId } });
      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
    } else if (targetType === 'user') {
      const user = await prisma.user.findUnique({ where: { id: targetId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason,
        description,
      },
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET /moderation/reports - List reports (admin)
router.get('/reports', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = '1', limit = '20' } = req.query as {
      status?: string;
      page?: string;
      limit?: string;
    };

    const where: any = {};
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          reporter: {
            select: { id: true, username: true, name: true },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({ reports, total, page: pageNum, limit: limitNum });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// PUT /moderation/reports/:reportId - Update report status
router.put('/reports/:reportId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params as { reportId: string };
    const { status } = req.body;

    if (!['reviewed', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolvedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : undefined,
      },
    });

    res.json({ report });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;

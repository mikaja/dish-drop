// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /collections - Get user's collections
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        coverImage: true,
        isPublic: true,
        isDefault: true,
        itemCount: true,
        createdAt: true,
        items: {
          take: 4,
          orderBy: { addedAt: 'desc' },
          select: {
            post: {
              select: {
                thumbnailUrl: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    }) as Array<{
      id: string;
      name: string;
      description: string | null;
      coverImage: string | null;
      isPublic: boolean;
      isDefault: boolean;
      itemCount: number;
      createdAt: Date;
      items: Array<{ post: { thumbnailUrl: string | null; imageUrl: string } }>;
    }>;

    // Transform to include preview images
    const collectionsWithPreviews = collections.map((c) => ({
      ...c,
      previewImages: c.items.map((i) => i.post.thumbnailUrl || i.post.imageUrl),
      items: undefined,
    }));

    res.json({ collections: collectionsWithPreviews });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Failed to get collections' });
  }
});

// GET /collections/public - Get public collections (for discovery)
router.get('/public', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, cursor, limit = '20' } = req.query as { userId?: string; cursor?: string; limit?: string };

    let whereClause: Record<string, unknown> = { isPublic: true };

    if (userId) {
      whereClause = { ...whereClause, userId: userId as string };
    }

    const collections = await prisma.collection.findMany({
      where: whereClause,
      orderBy: { itemCount: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        description: true,
        coverImage: true,
        itemCount: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            profileImage: true,
          },
        },
        items: {
          take: 4,
          orderBy: { addedAt: 'desc' },
          select: {
            post: {
              select: {
                thumbnailUrl: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    }) as Array<{
      id: string;
      name: string;
      description: string | null;
      coverImage: string | null;
      itemCount: number;
      createdAt: Date;
      user: { id: string; username: string; profileImage: string | null };
      items: Array<{ post: { thumbnailUrl: string | null; imageUrl: string } }>;
    }>;

    const hasMore = collections.length > parseInt(limit as string);
    if (hasMore) collections.pop();

    const collectionsWithPreviews = collections.map((c) => ({
      ...c,
      previewImages: c.items.map((i) => i.post.thumbnailUrl || i.post.imageUrl),
      items: undefined,
    }));

    res.json({
      collections: collectionsWithPreviews,
      nextCursor: hasMore ? collections[collections.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get public collections error:', error);
    res.status(500).json({ error: 'Failed to get collections' });
  }
});

// POST /collections - Create a collection
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const collectionSchema = z.object({
      name: z.string().min(1, 'Name is required').max(100),
      description: z.string().max(500).optional(),
      isPublic: z.boolean().optional(),
    });

    const validation = collectionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const collection = await prisma.collection.create({
      data: {
        userId: req.user!.userId,
        name: validation.data.name,
        description: validation.data.description,
        isPublic: validation.data.isPublic ?? true,
      },
    });

    res.status(201).json({ collection });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// GET /collections/:collectionId - Get collection with items
router.get('/:collectionId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params as { collectionId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profileImage: true,
          },
        },
      },
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    // Check access
    if (!collection.isPublic && req.user?.userId !== collection.userId) {
      res.status(403).json({ error: 'This collection is private' });
      return;
    }

    // Get items
    const items = await prisma.collectionItem.findMany({
      where: { collectionId },
      orderBy: { addedAt: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        addedAt: true,
        post: {
          select: {
            id: true,
            dishName: true,
            imageUrl: true,
            thumbnailUrl: true,
            rating: true,
            likeCount: true,
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    }) as Array<{ id: string; addedAt: Date; post: unknown }>;

    const hasMore = items.length > parseInt(limit as string);
    if (hasMore) items.pop();

    res.json({
      collection,
      items: items.map((i) => ({ ...i.post, addedAt: i.addedAt })),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ error: 'Failed to get collection' });
  }
});

// PUT /collections/:collectionId - Update collection
router.put('/:collectionId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params as { collectionId: string };

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (collection.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Cannot update another user\'s collection' });
      return;
    }

    if (collection.isDefault) {
      res.status(400).json({ error: 'Cannot modify default collections' });
      return;
    }

    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      coverImage: z.string().url().optional(),
      isPublic: z.boolean().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: validation.data,
    });

    res.json({ collection: updated });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// DELETE /collections/:collectionId - Delete collection
router.delete('/:collectionId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params as { collectionId: string };

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (collection.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Cannot delete another user\'s collection' });
      return;
    }

    if (collection.isDefault) {
      res.status(400).json({ error: 'Cannot delete default collections' });
      return;
    }

    await prisma.collection.delete({ where: { id: collectionId } });

    res.json({ message: 'Collection deleted' });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// POST /collections/:collectionId/items - Add post to collection
router.post('/:collectionId/items', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params as { collectionId: string };
    const { postId } = req.body;

    if (!postId) {
      res.status(400).json({ error: 'Post ID required' });
      return;
    }

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (collection.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Cannot add to another user\'s collection' });
      return;
    }

    // Check if already in collection
    const existing = await prisma.collectionItem.findUnique({
      where: { collectionId_postId: { collectionId, postId } },
    });

    if (existing) {
      res.status(400).json({ error: 'Post already in collection' });
      return;
    }

    await prisma.$transaction([
      prisma.collectionItem.create({
        data: { collectionId, postId },
      }),
      prisma.collection.update({
        where: { id: collectionId },
        data: { itemCount: { increment: 1 } },
      }),
    ]);

    res.json({ message: 'Added to collection' });
  } catch (error) {
    console.error('Add to collection error:', error);
    res.status(500).json({ error: 'Failed to add to collection' });
  }
});

// DELETE /collections/:collectionId/items/:postId - Remove from collection
router.delete('/:collectionId/items/:postId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId, postId } = req.params as { collectionId: string; postId: string };

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (collection.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Cannot remove from another user\'s collection' });
      return;
    }

    await prisma.$transaction([
      prisma.collectionItem.delete({
        where: { collectionId_postId: { collectionId, postId } },
      }),
      prisma.collection.update({
        where: { id: collectionId },
        data: { itemCount: { decrement: 1 } },
      }),
    ]);

    res.json({ message: 'Removed from collection' });
  } catch (error) {
    console.error('Remove from collection error:', error);
    res.status(500).json({ error: 'Failed to remove from collection' });
  }
});

export default router;

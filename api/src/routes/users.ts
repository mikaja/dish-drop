// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /users/:userId - Get user profile
router.get('/:userId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        profileImage: true,
        teamId: true,
        mealsDonated: true,
        postCount: true,
        mealStreak: true,
        isPrivate: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if current user follows this user
    let isFollowing = false;
    if (req.user) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.userId,
            followingId: userId,
          },
        },
      });
      isFollowing = !!follow;
    }

    res.json({ user: { ...user, isFollowing } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// PUT /users/:userId - Update user profile
router.put('/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };

    // Can only update own profile
    if (req.user!.userId !== userId) {
      res.status(403).json({ error: 'Cannot update another user\'s profile' });
      return;
    }

    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      bio: z.string().max(500).optional(),
      profileImage: z.string().url().optional(),
      isPrivate: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: validation.data,
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        profileImage: true,
        isPrivate: true,
        pushEnabled: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /users/:userId/posts - Get user's posts
router.get('/:userId/posts', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const posts = await prisma.post.findMany({
      where: {
        userId,
        // Only show private posts to the owner
        ...(req.user?.userId !== userId ? { isPrivate: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        dishName: true,
        imageUrl: true,
        thumbnailUrl: true,
        rating: true,
        caption: true,
        likeCount: true,
        commentCount: true,
        saveCount: true,
        createdAt: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const hasMore = posts.length > parseInt(limit as string);
    if (hasMore) posts.pop();

    res.json({
      posts,
      nextCursor: hasMore ? posts[posts.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// GET /users/:userId/likes - Get user's liked posts
router.get('/:userId/likes', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    // Check if user allows viewing likes (private by default)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPrivate: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Only owner can see their likes if private
    if (user.isPrivate && req.user?.userId !== userId) {
      res.status(403).json({ error: 'This user\'s likes are private' });
      return;
    }

    const likes = await prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
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
                profileImage: true,
              },
            },
          },
        },
      },
    }) as Array<{ id: string; createdAt: Date; post: unknown }>;

    const hasMore = likes.length > parseInt(limit as string);
    if (hasMore) likes.pop();

    res.json({
      likes: likes.map((l) => l.post),
      nextCursor: hasMore ? likes[likes.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get user likes error:', error);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// GET /users/:userId/followers - Get user's followers
router.get('/:userId/followers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        follower: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImage: true,
            mealsDonated: true,
          },
        },
      },
    }) as Array<{ id: string; createdAt: Date; follower: unknown }>;

    const hasMore = followers.length > parseInt(limit as string);
    if (hasMore) followers.pop();

    res.json({
      followers: followers.map((f) => f.follower),
      nextCursor: hasMore ? followers[followers.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// GET /users/:userId/following - Get users the user follows
router.get('/:userId/following', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImage: true,
            mealsDonated: true,
          },
        },
      },
    }) as Array<{ id: string; createdAt: Date; following: unknown }>;

    const hasMore = following.length > parseInt(limit as string);
    if (hasMore) following.pop();

    res.json({
      following: following.map((f) => f.following),
      nextCursor: hasMore ? following[following.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

// POST /users/:userId/follow - Follow a user
router.post('/:userId/follow', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const followerId = req.user!.userId;

    if (followerId === userId) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userId,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Already following this user' });
      return;
    }

    await prisma.follow.create({
      data: {
        followerId,
        followingId: userId,
      },
    });

    res.json({ message: 'Followed successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// DELETE /users/:userId/follow - Unfollow a user
router.delete('/:userId/follow', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    const followerId = req.user!.userId;

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: userId,
        },
      },
    });

    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// POST /users/:userId/block - Block a user
router.post('/:userId/block', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId: blockedId } = req.params as { userId: string };
    const userId = req.user!.userId;

    if (userId === blockedId) {
      res.status(400).json({ error: 'Cannot block yourself' });
      return;
    }

    // Check if already blocked
    const existing = await prisma.blockedUser.findUnique({
      where: {
        userId_blockedId: { userId, blockedId },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'User already blocked' });
      return;
    }

    // Block and unfollow in both directions
    await prisma.$transaction([
      prisma.blockedUser.create({
        data: { userId, blockedId },
      }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followingId: blockedId },
            { followerId: blockedId, followingId: userId },
          ],
        },
      }),
    ]);

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// DELETE /users/:userId/block - Unblock a user
router.delete('/:userId/block', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId: blockedId } = req.params as { userId: string };
    const userId = req.user!.userId;

    await prisma.blockedUser.delete({
      where: {
        userId_blockedId: { userId, blockedId },
      },
    });

    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// GET /users/me/blocked - List blocked users
router.get('/me/blocked', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const blocked = await prisma.blockedUser.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    res.json({ blocked });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

export default router;

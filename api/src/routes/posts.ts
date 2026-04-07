// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /posts - Get posts feed
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      feed,
      lat,
      lng,
      radius = '10000', // meters
      userId,
      restaurantId,
      cuisineType,
      cursor,
      limit = '20',
    } = req.query as {
      feed?: string;
      lat?: string;
      lng?: string;
      radius?: string;
      userId?: string;
      restaurantId?: string;
      cuisineType?: string;
      cursor?: string;
      limit?: string;
    };

    let whereClause: Record<string, unknown> = { isPrivate: false };

    // Filter by feed type
    if (feed === 'friends' && req.user) {
      // Get posts from users the current user follows
      const following = await prisma.follow.findMany({
        where: { followerId: req.user.userId },
        select: { followingId: true },
      });
      const followingIds = following.map((f) => f.followingId);
      whereClause = { ...whereClause, userId: { in: followingIds } };
    } else if (feed === 'nearby' && lat && lng) {
      // For nearby posts, we'll filter by restaurant location
      // This is a simplified version - for production, use PostGIS
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string) / 1000;

      // Approximate lat/lng bounds
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos(latitude * (Math.PI / 180)));

      const nearbyRestaurants = await prisma.restaurant.findMany({
        where: {
          latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
          longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta },
        },
        select: { id: true },
      });

      const restaurantIds = nearbyRestaurants.map((r) => r.id);
      whereClause = { ...whereClause, restaurantId: { in: restaurantIds } };
    }

    // Additional filters
    if (userId) {
      whereClause = { ...whereClause, userId: userId as string };
    }
    if (restaurantId) {
      whereClause = { ...whereClause, restaurantId: restaurantId as string };
    }
    if (cuisineType) {
      whereClause = { ...whereClause, cuisineType: cuisineType as string };
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
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
        price: true,
        dietaryTags: true,
        cuisineType: true,
        likeCount: true,
        commentCount: true,
        saveCount: true,
        donationMade: true,
        mealsDonated: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImage: true,
            mealStreak: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    const hasMore = posts.length > parseInt(limit as string);
    if (hasMore) posts.pop();

    // Add isLiked and isSaved for authenticated users
    let postsWithStatus = posts;
    if (req.user) {
      const postIds = posts.map((p) => p.id);

      const [likes, saves] = await Promise.all([
        prisma.like.findMany({
          where: { userId: req.user.userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.save.findMany({
          where: { userId: req.user.userId, postId: { in: postIds } },
          select: { postId: true },
        }),
      ]);

      const likedPostIds = new Set(likes.map((l) => l.postId));
      const savedPostIds = new Set(saves.map((s) => s.postId));

      postsWithStatus = posts.map((post) => ({
        ...post,
        isLiked: likedPostIds.has(post.id),
        isSaved: savedPostIds.has(post.id),
      }));
    }

    res.json({
      posts: postsWithStatus,
      nextCursor: hasMore ? posts[posts.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// POST /posts - Create a new post
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const postSchema = z.object({
      dishName: z.string().min(1, 'Dish name is required').max(200),
      imageUrl: z.string().url('Invalid image URL'),
      thumbnailUrl: z.string().url().optional(),
      rating: z.number().int().min(1).max(10),
      restaurantId: z.string(),
      caption: z.string().max(2000).optional(),
      price: z.number().positive().optional(),
      dietaryTags: z.array(z.string()).optional(),
      cuisineType: z.string().optional(),
      isPrivate: z.boolean().optional(),
      donateMeals: z.number().int().min(0).optional(),
    });

    const validation = postSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const data = validation.data;
    const userId = req.user!.userId;

    // Check if restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: data.restaurantId },
    });

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    // Handle meal donation
    let mealsDonated = 0;
    if (data.donateMeals && data.donateMeals > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { mealsBalance: true },
      });

      if (!user || user.mealsBalance < data.donateMeals) {
        res.status(400).json({ error: 'Insufficient meal balance' });
        return;
      }

      mealsDonated = data.donateMeals;
    }

    // Create post in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create post
      const post = await tx.post.create({
        data: {
          userId,
          dishName: data.dishName,
          imageUrl: data.imageUrl,
          thumbnailUrl: data.thumbnailUrl,
          rating: data.rating,
          restaurantId: data.restaurantId,
          caption: data.caption,
          price: data.price,
          dietaryTags: data.dietaryTags || [],
          cuisineType: data.cuisineType,
          isPrivate: data.isPrivate || false,
          donationMade: mealsDonated > 0,
          mealsDonated,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              profileImage: true,
            },
          },
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      // Update user stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lastPostDate: true, mealStreak: true },
      });

      let newStreak = 1;
      if (user?.lastPostDate) {
        const lastPost = new Date(user.lastPostDate);
        lastPost.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - lastPost.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          newStreak = user.mealStreak + 1;
        } else if (daysDiff === 0) {
          newStreak = user.mealStreak;
        }
      }

      // Award 1 coin for posting
      const COINS_PER_POST = 1;

      await tx.user.update({
        where: { id: userId },
        data: {
          postCount: { increment: 1 },
          lastPostDate: new Date(),
          mealStreak: newStreak,
          coins: { increment: COINS_PER_POST },
          totalCoins: { increment: COINS_PER_POST },
          ...(mealsDonated > 0
            ? {
                mealsBalance: { decrement: mealsDonated },
                mealsDonated: { increment: mealsDonated },
              }
            : {}),
        },
      });

      // Check for active flash sponsorships at this restaurant
      const activeSponsorship = await tx.flashSponsorship.findFirst({
        where: {
          restaurantId: data.restaurantId,
          isActive: true,
          endsAt: { gt: new Date() },
          isCompleted: false,
        },
      });

      let sponsorshipDrop = null;
      if (activeSponsorship) {
        // Record drop for sponsorship
        sponsorshipDrop = await tx.flashSponsorshipDrop.create({
          data: {
            sponsorshipId: activeSponsorship.id,
            userId,
            postId: post.id,
          },
        });

        // Increment sponsorship drop count
        await tx.flashSponsorship.update({
          where: { id: activeSponsorship.id },
          data: { currentDrops: { increment: 1 } },
        });
      }

      // Update restaurant stats
      await tx.restaurant.update({
        where: { id: data.restaurantId },
        data: {
          postCount: { increment: 1 },
          mealsDonated: { increment: mealsDonated },
          // Recalculate average rating
          averageRating: {
            set: await tx.post
              .aggregate({
                where: { restaurantId: data.restaurantId },
                _avg: { rating: true },
              })
              .then((r) => r._avg.rating || 0),
          },
        },
      });

      // Create donation record if applicable
      if (mealsDonated > 0) {
        await tx.donation.create({
          data: {
            userId,
            mealCount: mealsDonated,
            amount: 0,
            source: 'post',
            postId: post.id,
          },
        });

        // Update global stats
        await tx.globalStats.upsert({
          where: { id: 'global' },
          update: {
            totalMeals: { increment: mealsDonated },
          },
          create: {
            id: 'global',
            totalMeals: mealsDonated,
          },
        });
      }

      return { post, sponsorshipDrop, activeSponsorship };
    });

    res.status(201).json({
      post: result.post,
      coinsEarned: 1,
      sponsorship: result.activeSponsorship ? {
        id: result.activeSponsorship.id,
        title: result.activeSponsorship.title,
        contributed: true,
      } : null,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// GET /posts/:postId - Get single post
router.get('/:postId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImage: true,
            mealStreak: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check privacy
    if (post.isPrivate && req.user?.userId !== post.userId) {
      res.status(403).json({ error: 'This post is private' });
      return;
    }

    // Add isLiked and isSaved for authenticated users
    let isLiked = false;
    let isSaved = false;

    if (req.user) {
      const [like, save] = await Promise.all([
        prisma.like.findUnique({
          where: { postId_userId: { postId, userId: req.user.userId } },
        }),
        prisma.save.findUnique({
          where: { postId_userId: { postId, userId: req.user.userId } },
        }),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    // Increment view count
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ post: { ...post, isLiked, isSaved } });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// DELETE /posts/:postId - Delete post
router.delete('/:postId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, restaurantId: true, rating: true },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Cannot delete another user\'s post' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.delete({ where: { id: postId } });

      // Update user post count
      await tx.user.update({
        where: { id: post.userId },
        data: { postCount: { decrement: 1 } },
      });

      // Update restaurant stats
      const avgRating = await tx.post.aggregate({
        where: { restaurantId: post.restaurantId },
        _avg: { rating: true },
      });

      await tx.restaurant.update({
        where: { id: post.restaurantId },
        data: {
          postCount: { decrement: 1 },
          averageRating: avgRating._avg.rating || 0,
        },
      });
    });

    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// POST /posts/:postId/like - Like a post
router.post('/:postId/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };
    const userId = req.user!.userId;

    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      res.status(400).json({ error: 'Already liked' });
      return;
    }

    await prisma.$transaction([
      prisma.like.create({ data: { postId, userId } }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);

    res.json({ message: 'Liked' });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// DELETE /posts/:postId/like - Unlike a post
router.delete('/:postId/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };
    const userId = req.user!.userId;

    await prisma.$transaction([
      prisma.like.delete({
        where: { postId_userId: { postId, userId } },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);

    res.json({ message: 'Unliked' });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// POST /posts/:postId/save - Save a post
router.post('/:postId/save', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };
    const { collectionId } = req.body;
    const userId = req.user!.userId;

    // Check if already saved
    const existing = await prisma.save.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      res.status(400).json({ error: 'Already saved' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.save.create({ data: { postId, userId } });
      await tx.post.update({
        where: { id: postId },
        data: { saveCount: { increment: 1 } },
      });

      // If collection specified, add to collection
      if (collectionId) {
        const collection = await tx.collection.findUnique({
          where: { id: collectionId },
        });

        if (collection && collection.userId === userId) {
          await tx.collectionItem.create({
            data: { collectionId, postId },
          });
          await tx.collection.update({
            where: { id: collectionId },
            data: { itemCount: { increment: 1 } },
          });
        }
      }
    });

    res.json({ message: 'Saved' });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// DELETE /posts/:postId/save - Unsave a post
router.delete('/:postId/save', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };
    const userId = req.user!.userId;

    await prisma.$transaction([
      prisma.save.delete({
        where: { postId_userId: { postId, userId } },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { saveCount: { decrement: 1 } },
      }),
    ]);

    res.json({ message: 'Unsaved' });
  } catch (error) {
    console.error('Unsave error:', error);
    res.status(500).json({ error: 'Failed to unsave post' });
  }
});

// GET /posts/:postId/comments - Get comments for a post
router.get('/:postId/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };
    const { cursor, limit = '50' } = req.query as { cursor?: string; limit?: string };

    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
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

    const hasMore = comments.length > parseInt(limit as string);
    if (hasMore) comments.pop();

    res.json({
      comments,
      nextCursor: hasMore ? comments[comments.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// POST /posts/:postId/comments - Add a comment
router.post('/:postId/comments', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params as { postId: string };
    const { content, parentId } = req.body;
    const userId = req.user!.userId;

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    if (content.length > 1000) {
      res.status(400).json({ error: 'Comment too long (max 1000 characters)' });
      return;
    }

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId,
          userId,
          content: content.trim(),
          parentId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profileImage: true,
            },
          },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;

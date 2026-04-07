// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /restaurants - Get restaurants
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      lat,
      lng,
      radius = '5000',
      cuisine,
      priceLevel,
      search,
      cursor,
      limit = '20',
    } = req.query;

    let whereClause: Record<string, unknown> = {};

    // Location-based filtering
    if (lat && lng) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string) / 1000;

      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos(latitude * (Math.PI / 180)));

      whereClause = {
        ...whereClause,
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta },
      };
    }

    // Cuisine filter
    if (cuisine) {
      whereClause = {
        ...whereClause,
        cuisineTypes: { has: cuisine as string },
      };
    }

    // Price level filter
    if (priceLevel) {
      whereClause = {
        ...whereClause,
        priceLevel: parseInt(priceLevel as string),
      };
    }

    // Search
    if (search) {
      whereClause = {
        ...whereClause,
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { city: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    const restaurants = await prisma.restaurant.findMany({
      where: whereClause,
      orderBy: [{ postCount: 'desc' }, { averageRating: 'desc' }],
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverImage: true,
        address: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        postCount: true,
        averageRating: true,
        cuisineTypes: true,
        priceLevel: true,
      },
    });

    const hasMore = restaurants.length > parseInt(limit as string);
    if (hasMore) restaurants.pop();

    res.json({
      restaurants,
      nextCursor: hasMore ? restaurants[restaurants.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ error: 'Failed to get restaurants' });
  }
});

// GET /restaurants/nearby - Get nearby restaurants for post creation
router.get('/nearby', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, limit = '10' } = req.query;

    if (!lat || !lng) {
      res.status(400).json({ error: 'Location required' });
      return;
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    // Find restaurants within ~2km
    const radiusKm = 2;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(latitude * (Math.PI / 180)));

    const restaurants = await prisma.restaurant.findMany({
      where: {
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta },
      },
      orderBy: { postCount: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        averageRating: true,
        postCount: true,
      },
    });

    res.json({ restaurants });
  } catch (error) {
    console.error('Get nearby restaurants error:', error);
    res.status(500).json({ error: 'Failed to get nearby restaurants' });
  }
});

// GET /restaurants/:restaurantId - Get single restaurant
router.get('/:restaurantId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    // Try by ID first, then by slug
    let restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      restaurant = await prisma.restaurant.findUnique({
        where: { slug: restaurantId },
      });
    }

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    res.json({ restaurant });
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({ error: 'Failed to get restaurant' });
  }
});

// GET /restaurants/:restaurantId/menu - Get restaurant menu data
router.get('/:restaurantId/menu', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { menu: true },
    });

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    const menu = restaurant.menu as {
      categories: Array<{ name: string; items: Array<{ name: string; description?: string; price?: string }> }>;
    } | null;

    res.json({ menu: menu || { categories: [] } });
  } catch (error) {
    console.error('Get restaurant menu error:', error);
    res.status(500).json({ error: 'Failed to get menu' });
  }
});

// GET /restaurants/:restaurantId/posts - Get restaurant's posts
router.get('/:restaurantId/posts', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { sort = 'recent', cursor, limit = '20' } = req.query;

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'popular':
        orderBy = { likeCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const posts = await prisma.post.findMany({
      where: { restaurantId, isPrivate: false },
      orderBy,
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
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            profileImage: true,
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
    console.error('Get restaurant posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// POST /restaurants - Create a restaurant (for when user posts at new location)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantSchema = z.object({
      name: z.string().min(1).max(200),
      address: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1).max(50),
      zipCode: z.string().min(1).max(20),
      latitude: z.number(),
      longitude: z.number(),
      phone: z.string().optional(),
      website: z.string().url().optional(),
      cuisineTypes: z.array(z.string()).optional(),
      priceLevel: z.number().int().min(1).max(4).optional(),
    });

    const validation = restaurantSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const data = validation.data;

    // Generate slug from name
    const baseSlug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        ...data,
        slug,
        cuisineTypes: data.cuisineTypes || [],
      },
    });

    res.status(201).json({ restaurant });
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

export default router;

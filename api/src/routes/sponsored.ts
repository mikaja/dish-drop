// @ts-nocheck
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// ==========================================
// SPONSORED POST FEED (for explore page)
// ==========================================

// GET /sponsored/feed - Get a sponsored post for the user's feed
// This replaces the mock data in the mobile app explore page
router.get('/feed', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.query;

    // Budget check is done in-memory after fetch since Prisma can't compare two columns

    // If we have location, prefer geo-targeted posts
    let sponsoredPost = null;

    if (lat && lng) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      // Find sponsored posts within target radius
      // Using a simple bounding box for performance
      const allActive = await prisma.sponsoredPost.findMany({
        where: {
          isActive: true,
          OR: [
            { endsAt: null },
            { endsAt: { gt: new Date() } },
          ],
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              address: true,
              city: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Filter by budget remaining and geo proximity
      const eligiblePosts = allActive.filter((sp) => {
        if (sp.totalSpent >= sp.maxBudget) return false;

        if (sp.targetLatitude && sp.targetLongitude) {
          const dist = haversineKm(latitude, longitude, sp.targetLatitude, sp.targetLongitude);
          return dist <= sp.targetRadius;
        }
        // No geo-targeting = show everywhere
        return true;
      });

      // Pick one (weighted random by remaining budget)
      if (eligiblePosts.length > 0) {
        const totalBudgetRemaining = eligiblePosts.reduce((sum, sp) => sum + (sp.maxBudget - sp.totalSpent), 0);
        let random = Math.random() * totalBudgetRemaining;
        for (const sp of eligiblePosts) {
          random -= (sp.maxBudget - sp.totalSpent);
          if (random <= 0) {
            sponsoredPost = sp;
            break;
          }
        }
        if (!sponsoredPost) sponsoredPost = eligiblePosts[0];
      }
    } else {
      // No location - just pick a random active one
      const activePosts = await prisma.sponsoredPost.findMany({
        where: {
          isActive: true,
          OR: [
            { endsAt: null },
            { endsAt: { gt: new Date() } },
          ],
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              address: true,
              city: true,
            },
          },
        },
      });

      const eligible = activePosts.filter((sp) => sp.totalSpent < sp.maxBudget);
      if (eligible.length > 0) {
        sponsoredPost = eligible[Math.floor(Math.random() * eligible.length)];
      }
    }

    if (!sponsoredPost) {
      res.json({ sponsored: null });
      return;
    }

    // Record impression
    await prisma.sponsoredPost.update({
      where: { id: sponsoredPost.id },
      data: { impressions: { increment: 1 } },
    });

    // Format for mobile app's SponsoredPost type
    const ctaTextMap: Record<string, string> = {
      get_directions: 'Get Directions',
      reserve: 'Reserve a Table',
      order_online: 'Order Now',
    };

    res.json({
      sponsored: {
        id: sponsoredPost.id,
        restaurantId: sponsoredPost.restaurantId,
        restaurant: {
          id: sponsoredPost.restaurant.id,
          name: sponsoredPost.restaurant.name,
        },
        imageUrl: sponsoredPost.dishPhotoUrl,
        title: sponsoredPost.caption || `Visit ${sponsoredPost.restaurant.name}`,
        subtitle: `${sponsoredPost.restaurant.city} · ${sponsoredPost.restaurant.address}`,
        ctaText: ctaTextMap[sponsoredPost.callToAction] || 'Learn More',
        ctaUrl: sponsoredPost.actionUrl || null,
        isSponsored: true,
      },
    });
  } catch (error) {
    console.error('Get sponsored feed error:', error);
    res.status(500).json({ error: 'Failed to get sponsored content' });
  }
});

// POST /sponsored/:id/click - Record a click on a sponsored post (PPC billing)
router.post('/:id/click', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sponsoredPost = await prisma.sponsoredPost.findUnique({ where: { id } });
    if (!sponsoredPost) {
      res.status(404).json({ error: 'Sponsored post not found' });
      return;
    }

    if (!sponsoredPost.isActive) {
      res.json({ message: 'Post no longer active' });
      return;
    }

    // Charge per click and record it
    const newTotalSpent = sponsoredPost.totalSpent + sponsoredPost.costPerClick;

    const updates: any = {
      clicks: { increment: 1 },
      totalSpent: newTotalSpent,
    };

    // Auto-deactivate if budget exhausted
    if (newTotalSpent >= sponsoredPost.maxBudget) {
      updates.isActive = false;
    }

    await prisma.sponsoredPost.update({
      where: { id },
      data: updates,
    });

    res.json({ message: 'Click recorded', charged: sponsoredPost.costPerClick });
  } catch (error) {
    console.error('Record sponsored click error:', error);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// POST /sponsored/:id/reserve - Record a reservation action
router.post('/:id/reserve', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.sponsoredPost.update({
      where: { id },
      data: { reservations: { increment: 1 } },
    });

    res.json({ message: 'Reservation recorded' });
  } catch (error) {
    console.error('Record reservation error:', error);
    res.status(500).json({ error: 'Failed to record reservation' });
  }
});

// ==========================================
// MYSTERY BOX PUBLIC ENDPOINTS
// ==========================================

// GET /sponsored/mystery-boxes - Get today's active mystery boxes near user
router.get('/mystery-boxes', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const mysteryBoxes = await prisma.mysteryBox.findMany({
      where: {
        isActive: true,
        activeDate: { gte: today, lt: tomorrow },
        expiresAt: { gt: new Date() },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let results = mysteryBoxes;

    // Filter by distance if location provided
    if (lat && lng) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      results = mysteryBoxes.filter((box) => {
        const dist = haversineKm(latitude, longitude, box.restaurant.latitude, box.restaurant.longitude);
        return dist <= box.targetRadius;
      });
    }

    // Filter out fully redeemed boxes
    results = results.filter((box) => box.currentRedemptions < box.maxRedemptions);

    res.json({
      mysteryBoxes: results.map((box) => ({
        id: box.id,
        restaurant: box.restaurant,
        offerTitle: box.offerTitle,
        offerDescription: box.offerDescription,
        discountType: box.discountType,
        discountValue: box.discountValue,
        remainingClaims: box.maxRedemptions - box.currentRedemptions,
        expiresAt: box.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Get mystery boxes error:', error);
    res.status(500).json({ error: 'Failed to get mystery boxes' });
  }
});

// POST /sponsored/mystery-boxes/:id/claim - Claim a mystery box
router.post('/mystery-boxes/:id/claim', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const mysteryBox = await prisma.mysteryBox.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
    });

    if (!mysteryBox) {
      res.status(404).json({ error: 'Mystery box not found' });
      return;
    }

    if (!mysteryBox.isActive || mysteryBox.expiresAt < new Date()) {
      res.status(400).json({ error: 'Mystery box has expired' });
      return;
    }

    if (mysteryBox.currentRedemptions >= mysteryBox.maxRedemptions) {
      res.status(400).json({ error: 'Mystery box is fully claimed' });
      return;
    }

    // Update mystery box counts
    await prisma.mysteryBox.update({
      where: { id },
      data: {
        claims: { increment: 1 },
        currentRedemptions: { increment: 1 },
      },
    });

    // Create a coupon for the user from this mystery box
    const coupon = await prisma.coupon.create({
      data: {
        restaurantId: mysteryBox.restaurantId,
        title: mysteryBox.offerTitle,
        description: mysteryBox.offerDescription,
        discountType: mysteryBox.discountType,
        discountValue: mysteryBox.discountValue,
        coinCost: 0, // Free from mystery box
        totalQuantity: 1,
        expiresAt: mysteryBox.expiresAt,
      },
    });

    // Auto-claim it for the user
    const userCoupon = await prisma.userCoupon.create({
      data: {
        userId,
        couponId: coupon.id,
        expiresAt: mysteryBox.expiresAt,
      },
      include: {
        coupon: {
          include: {
            restaurant: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      userCoupon,
      mysteryBox: {
        offerTitle: mysteryBox.offerTitle,
        discountType: mysteryBox.discountType,
        discountValue: mysteryBox.discountValue,
        restaurant: mysteryBox.restaurant,
      },
      message: 'Mystery box claimed! Check your coupons.',
    });
  } catch (error) {
    console.error('Claim mystery box error:', error);
    res.status(500).json({ error: 'Failed to claim mystery box' });
  }
});

// ==========================================
// HELPER: Haversine distance
// ==========================================

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export default router;

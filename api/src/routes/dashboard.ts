import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// Helper: verify restaurant ownership
async function verifyOwnership(userId: string, restaurantId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant || !restaurant.isClaimed) return false;
  return restaurant.ownerEmail === user.email;
}

// ==========================================
// RESTAURANT CLAIM & VERIFICATION
// ==========================================

// POST /dashboard/claim - Submit a restaurant claim
router.post('/claim', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { restaurantId, contactName, contactEmail, contactPhone, role, proofType, proofUrl, socialAccounts } = req.body;

    if (!restaurantId || !contactName || !contactEmail || !contactPhone || !role || !proofType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }
    if (restaurant.isClaimed) {
      res.status(400).json({ error: 'Restaurant is already claimed' });
      return;
    }

    // Check for existing pending claim
    const existingClaim = await prisma.restaurantClaim.findFirst({
      where: { restaurantId, status: 'pending' },
    });
    if (existingClaim) {
      res.status(400).json({ error: 'A claim is already pending for this restaurant' });
      return;
    }

    const claim = await prisma.restaurantClaim.create({
      data: {
        restaurantId,
        contactName,
        contactEmail,
        contactPhone,
        role,
        proofType,
        proofUrl: proofUrl || null,
        socialAccounts: socialAccounts || null,
      },
    });

    res.status(201).json({ claim });
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

// GET /dashboard/claims/:restaurantId - Get claim status
router.get('/claims/:restaurantId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const claims = await prisma.restaurantClaim.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ claims });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// POST /dashboard/claims/:claimId/approve - Admin: approve a claim
router.post('/claims/:claimId/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimId } = req.params;

    const claim = await prisma.restaurantClaim.findUnique({ where: { id: claimId } });
    if (!claim) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    // Update claim and restaurant in a transaction
    const [updatedClaim] = await prisma.$transaction([
      prisma.restaurantClaim.update({
        where: { id: claimId },
        data: { status: 'approved', reviewedAt: new Date() },
      }),
      prisma.restaurant.update({
        where: { id: claim.restaurantId },
        data: { isClaimed: true, ownerEmail: claim.contactEmail },
      }),
    ]);

    res.json({ claim: updatedClaim });
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(500).json({ error: 'Failed to approve claim' });
  }
});

// ==========================================
// RESTAURANT OVERVIEW (for claimed restaurants)
// ==========================================

// GET /dashboard/:restaurantId/overview - Get dashboard overview
router.get('/:restaurantId/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized to view this dashboard' });
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        _count: {
          select: {
            posts: true,
            coupons: true,
            flashSponsorships: true,
            sponsoredPosts: true,
            mysteryBoxes: true,
          },
        },
      },
    });

    // Get 7-day and 30-day stats
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recentPosts7d, recentPosts30d, saves7d, saves30d] = await Promise.all([
      prisma.post.count({ where: { restaurantId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.post.count({ where: { restaurantId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.save.count({
        where: { post: { restaurantId }, createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.save.count({
        where: { post: { restaurantId }, createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    res.json({
      restaurant,
      stats: {
        profileViews7d: recentPosts7d * 12, // Estimated from post activity
        profileViews30d: recentPosts30d * 12,
        saves7d,
        saves30d,
        newReviews7d: recentPosts7d,
        newReviews30d: recentPosts30d,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

// ==========================================
// SPONSORED POSTS
// ==========================================

// POST /dashboard/:restaurantId/sponsored-posts - Create sponsored post
router.post('/:restaurantId/sponsored-posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { dishPhotoUrl, caption, callToAction, actionUrl, targetRadius, maxBudget, costPerClick, startsAt, endsAt } = req.body;

    if (!dishPhotoUrl || !callToAction || !maxBudget) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });

    const sponsoredPost = await prisma.sponsoredPost.create({
      data: {
        restaurantId,
        dishPhotoUrl,
        caption: caption || null,
        callToAction,
        actionUrl: actionUrl || null,
        targetRadius: targetRadius || 5.0,
        targetLatitude: restaurant?.latitude,
        targetLongitude: restaurant?.longitude,
        maxBudget,
        costPerClick: costPerClick || 0.50,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    res.status(201).json({ sponsoredPost });
  } catch (error) {
    console.error('Error creating sponsored post:', error);
    res.status(500).json({ error: 'Failed to create sponsored post' });
  }
});

// GET /dashboard/:restaurantId/sponsored-posts - List sponsored posts
router.get('/:restaurantId/sponsored-posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const sponsoredPosts = await prisma.sponsoredPost.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sponsoredPosts });
  } catch (error) {
    console.error('Error fetching sponsored posts:', error);
    res.status(500).json({ error: 'Failed to fetch sponsored posts' });
  }
});

// PUT /dashboard/:restaurantId/sponsored-posts/:postId - Update sponsored post
router.put('/:restaurantId/sponsored-posts/:postId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId, postId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { isActive, maxBudget, costPerClick, targetRadius, endsAt } = req.body;

    const updated = await prisma.sponsoredPost.update({
      where: { id: postId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(maxBudget !== undefined && { maxBudget }),
        ...(costPerClick !== undefined && { costPerClick }),
        ...(targetRadius !== undefined && { targetRadius }),
        ...(endsAt !== undefined && { endsAt: new Date(endsAt) }),
      },
    });

    res.json({ sponsoredPost: updated });
  } catch (error) {
    console.error('Error updating sponsored post:', error);
    res.status(500).json({ error: 'Failed to update sponsored post' });
  }
});

// ==========================================
// FLASH SPONSORSHIPS (from dashboard)
// ==========================================

// POST /dashboard/:restaurantId/flash-sponsorships - Create flash sponsorship
router.post('/:restaurantId/flash-sponsorships', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { title, description, targetDrops, mealsToDonatePer, bonusMeals, totalMealsPledged, endsAt, bannerUrl, charityName, charityLogo } = req.body;

    if (!title || !targetDrops || !totalMealsPledged || !endsAt) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const sponsorship = await prisma.flashSponsorship.create({
      data: {
        restaurantId,
        title,
        description: description || null,
        targetDrops,
        mealsToDonatePer: mealsToDonatePer || 0,
        bonusMeals: bonusMeals || 0,
        totalMealsPledged,
        endsAt: new Date(endsAt),
        bannerUrl: bannerUrl || null,
        charityName: charityName || null,
        charityLogo: charityLogo || null,
      },
    });

    res.status(201).json({ sponsorship });
  } catch (error) {
    console.error('Error creating flash sponsorship:', error);
    res.status(500).json({ error: 'Failed to create flash sponsorship' });
  }
});

// GET /dashboard/:restaurantId/flash-sponsorships - List restaurant's flash sponsorships
router.get('/:restaurantId/flash-sponsorships', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const sponsorships = await prisma.flashSponsorship.findMany({
      where: { restaurantId },
      include: { _count: { select: { drops: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sponsorships });
  } catch (error) {
    console.error('Error fetching flash sponsorships:', error);
    res.status(500).json({ error: 'Failed to fetch flash sponsorships' });
  }
});

// ==========================================
// MYSTERY BOX
// ==========================================

// POST /dashboard/:restaurantId/mystery-boxes - Create mystery box
router.post('/:restaurantId/mystery-boxes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { offerTitle, offerDescription, discountType, discountValue, targetRadius, maxRedemptions, budget, costPerClaim, activeDate, expiresAt } = req.body;

    if (!offerTitle || !discountType || discountValue === undefined || !maxRedemptions || !budget || !activeDate || !expiresAt) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const mysteryBox = await prisma.mysteryBox.create({
      data: {
        restaurantId,
        offerTitle,
        offerDescription: offerDescription || null,
        discountType,
        discountValue,
        targetRadius: targetRadius || 5.0,
        maxRedemptions,
        budget,
        costPerClaim: costPerClaim || 1.50,
        activeDate: new Date(activeDate),
        expiresAt: new Date(expiresAt),
      },
    });

    res.status(201).json({ mysteryBox });
  } catch (error) {
    console.error('Error creating mystery box:', error);
    res.status(500).json({ error: 'Failed to create mystery box' });
  }
});

// GET /dashboard/:restaurantId/mystery-boxes - List mystery boxes
router.get('/:restaurantId/mystery-boxes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const mysteryBoxes = await prisma.mysteryBox.findMany({
      where: { restaurantId },
      orderBy: { activeDate: 'desc' },
    });

    res.json({ mysteryBoxes });
  } catch (error) {
    console.error('Error fetching mystery boxes:', error);
    res.status(500).json({ error: 'Failed to fetch mystery boxes' });
  }
});

// ==========================================
// COUPON MANAGEMENT (from dashboard)
// ==========================================

// POST /dashboard/:restaurantId/coupons - Create coupon
router.post('/:restaurantId/coupons', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { title, description, discountType, discountValue, minPurchase, coinCost, totalQuantity, expiresAt, imageUrl } = req.body;

    if (!title || !discountType || discountValue === undefined || !coinCost) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const coupon = await prisma.coupon.create({
      data: {
        restaurantId,
        title,
        description: description || null,
        discountType,
        discountValue,
        minPurchase: minPurchase || null,
        coinCost,
        totalQuantity: totalQuantity || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        imageUrl: imageUrl || null,
      },
    });

    res.status(201).json({ coupon });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// GET /dashboard/:restaurantId/coupons - List restaurant's coupons with stats
router.get('/:restaurantId/coupons', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const coupons = await prisma.coupon.findMany({
      where: { restaurantId },
      include: {
        _count: { select: { userCoupons: true } },
        userCoupons: {
          where: { status: 'used' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const couponsWithStats = coupons.map((c) => ({
      ...c,
      totalClaimed: c._count.userCoupons,
      totalRedeemed: c.userCoupons.length,
      userCoupons: undefined,
    }));

    res.json({ coupons: couponsWithStats });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// ==========================================
// MENU MANAGEMENT
// ==========================================

// GET /dashboard/:restaurantId/menu - Get current menu
router.get('/:restaurantId/menu', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, menu: true, menuUrl: true },
    });

    res.json({ menu: restaurant?.menu || { categories: [] }, menuUrl: restaurant?.menuUrl });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// PUT /dashboard/:restaurantId/menu - Update entire menu
router.put('/:restaurantId/menu', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { menu, menuUrl } = req.body;

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(menu !== undefined && { menu }),
        ...(menuUrl !== undefined && { menuUrl }),
      },
      select: { id: true, menu: true, menuUrl: true },
    });

    res.json({ menu: updated.menu, menuUrl: updated.menuUrl });
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

// POST /dashboard/:restaurantId/menu/items - Add a menu item to a category
router.post('/:restaurantId/menu/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { categoryName, item } = req.body;
    if (!categoryName || !item || !item.name) {
      res.status(400).json({ error: 'Category name and item name are required' });
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { menu: true },
    });

    const menu: any = restaurant?.menu || { categories: [] };
    let category = menu.categories.find((c: any) => c.name === categoryName);
    if (!category) {
      category = { name: categoryName, items: [] };
      menu.categories.push(category);
    }
    category.items.push({
      name: item.name,
      description: item.description || '',
      price: item.price || '',
      photoUrl: item.photoUrl || null,
      dietaryTags: item.dietaryTags || [],
      isLimitedTime: item.isLimitedTime || false,
      isFeatured: item.isFeatured || false,
    });

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { menu },
      select: { menu: true },
    });

    res.json({ menu: updated.menu });
  } catch (error) {
    console.error('Error adding menu item:', error);
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

// ==========================================
// CONTENT APPEALS & MODERATION
// ==========================================

// POST /dashboard/:restaurantId/appeals - Create content appeal
router.post('/:restaurantId/appeals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { postId, reason, description } = req.body;

    if (!postId || !reason || !description) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify the post is about this restaurant
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.restaurantId !== restaurantId) {
      res.status(400).json({ error: 'Post does not belong to this restaurant' });
      return;
    }

    const appeal = await prisma.contentAppeal.create({
      data: {
        restaurantId,
        postId,
        reason,
        description,
      },
    });

    res.status(201).json({ appeal });
  } catch (error) {
    console.error('Error creating appeal:', error);
    res.status(500).json({ error: 'Failed to create appeal' });
  }
});

// GET /dashboard/:restaurantId/appeals - List appeals
router.get('/:restaurantId/appeals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const appeals = await prisma.contentAppeal.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ appeals });
  } catch (error) {
    console.error('Error fetching appeals:', error);
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

// ==========================================
// ANALYTICS
// ==========================================

// GET /dashboard/:restaurantId/analytics - Get detailed analytics
router.get('/:restaurantId/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevThirtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get post-based analytics
    const [
      posts30d,
      postsPrev30d,
      totalSaves,
      saves30d,
      topDishes,
      recentRatings,
    ] = await Promise.all([
      prisma.post.count({ where: { restaurantId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.post.count({ where: { restaurantId, createdAt: { gte: prevThirtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.save.count({ where: { post: { restaurantId } } }),
      prisma.save.count({ where: { post: { restaurantId }, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.post.groupBy({
        by: ['dishName'],
        where: { restaurantId },
        _count: { id: true },
        _avg: { rating: true },
        _sum: { saveCount: true, viewCount: true, likeCount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.post.findMany({
        where: { restaurantId, createdAt: { gte: thirtyDaysAgo } },
        select: { rating: true },
      }),
    ]);

    // Calculate traffic growth
    const trafficGrowth = postsPrev30d > 0
      ? ((posts30d - postsPrev30d) / postsPrev30d * 100).toFixed(1)
      : posts30d > 0 ? '100.0' : '0.0';

    // Average rating from recent posts
    const avgRating = recentRatings.length > 0
      ? recentRatings.reduce((sum, p) => sum + p.rating, 0) / recentRatings.length
      : null;

    // Dish metrics
    const dishMetrics = topDishes.map((d) => ({
      dishName: d.dishName,
      postCount: d._count.id,
      averageRating: d._avg.rating ? Number(d._avg.rating.toFixed(1)) : null,
      totalSaves: d._sum.saveCount || 0,
      totalViews: d._sum.viewCount || 0,
      totalLikes: d._sum.likeCount || 0,
    }));

    res.json({
      analytics: {
        overview: {
          totalPosts: await prisma.post.count({ where: { restaurantId } }),
          newReviews30d: posts30d,
          totalSaves,
          saves30d,
          trafficGrowthPercent: parseFloat(trafficGrowth as string),
          averageRating30d: avgRating ? Number(avgRating.toFixed(1)) : null,
        },
        dishMetrics,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /dashboard/:restaurantId/analytics/sponsorships - Get sponsorship performance
router.get('/:restaurantId/analytics/sponsorships', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.userId;

    const isOwner = await verifyOwnership(userId, restaurantId);
    if (!isOwner) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const [sponsoredPosts, flashSponsorships, mysteryBoxes, coupons] = await Promise.all([
      prisma.sponsoredPost.findMany({
        where: { restaurantId },
        select: { id: true, impressions: true, clicks: true, totalSpent: true, maxBudget: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.flashSponsorship.findMany({
        where: { restaurantId },
        select: { id: true, title: true, currentDrops: true, targetDrops: true, totalMealsDonated: true, totalMealsPledged: true, isCompleted: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.mysteryBox.findMany({
        where: { restaurantId },
        select: { id: true, offerTitle: true, opens: true, claims: true, redemptions: true, budget: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.coupon.findMany({
        where: { restaurantId },
        include: { _count: { select: { userCoupons: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      sponsorshipAnalytics: {
        sponsoredPosts: sponsoredPosts.map((sp) => ({
          ...sp,
          ctr: sp.impressions > 0 ? ((sp.clicks / sp.impressions) * 100).toFixed(2) : '0.00',
          costPerConversion: sp.clicks > 0 ? (sp.totalSpent / sp.clicks).toFixed(2) : null,
        })),
        flashSponsorships,
        mysteryBoxes,
        coupons: coupons.map((c) => ({
          id: c.id,
          title: c.title,
          coinCost: c.coinCost,
          totalClaimed: c._count.userCoupons,
          claimedCount: c.claimedCount,
          isActive: c.isActive,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching sponsorship analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sponsorship analytics' });
  }
});

export default router;

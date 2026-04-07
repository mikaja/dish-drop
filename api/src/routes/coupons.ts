// @ts-nocheck
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /coupons - Get all available coupons
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.query as { restaurantId?: string };

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        ...(restaurantId && { restaurantId: restaurantId as string }),
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            city: true,
          },
        },
        _count: {
          select: {
            userCoupons: true,
          },
        },
      },
      orderBy: { coinCost: 'asc' },
    });

    // Check if user has already claimed each coupon
    let userClaimedCoupons: string[] = [];
    if (req.user) {
      const userCoupons = await prisma.userCoupon.findMany({
        where: { userId: req.user.userId },
        select: { couponId: true },
      });
      userClaimedCoupons = userCoupons.map((uc) => uc.couponId);
    }

    const couponsWithStatus = coupons.map((coupon) => ({
      ...coupon,
      isClaimed: userClaimedCoupons.includes(coupon.id),
      remaining: coupon.totalQuantity ? coupon.totalQuantity - coupon.claimedCount : null,
    }));

    res.json({ coupons: couponsWithStatus });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ error: 'Failed to get coupons' });
  }
});

// GET /coupons/mine - Get user's claimed coupons
router.get('/mine', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userCoupons = await prisma.userCoupon.findMany({
      where: { userId: req.user!.userId },
      include: {
        coupon: {
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
        },
      },
      orderBy: { claimedAt: 'desc' },
    });

    res.json({ coupons: userCoupons });
  } catch (error) {
    console.error('Get my coupons error:', error);
    res.status(500).json({ error: 'Failed to get coupons' });
  }
});

// POST /coupons/:id/claim - Claim a coupon with coins
router.post('/:id/claim', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: couponId } = req.params as { id: string };
    const userId = req.user!.userId;

    // Get coupon and user
    const [coupon, user] = await Promise.all([
      prisma.coupon.findUnique({ where: { id: couponId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    if (!coupon.isActive) {
      res.status(400).json({ error: 'Coupon is no longer active' });
      return;
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      res.status(400).json({ error: 'Coupon has expired' });
      return;
    }

    if (coupon.totalQuantity && coupon.claimedCount >= coupon.totalQuantity) {
      res.status(400).json({ error: 'Coupon is sold out' });
      return;
    }

    if (!user || user.coins < coupon.coinCost) {
      res.status(400).json({ error: 'Not enough coins' });
      return;
    }

    // Check if already claimed
    const existingClaim = await prisma.userCoupon.findFirst({
      where: { userId, couponId },
    });

    if (existingClaim) {
      res.status(400).json({ error: 'Already claimed this coupon' });
      return;
    }

    // Transaction: deduct coins, create user coupon, update coupon count
    const [userCoupon] = await prisma.$transaction([
      prisma.userCoupon.create({
        data: {
          userId,
          couponId,
          expiresAt: coupon.expiresAt,
        },
        include: {
          coupon: {
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { coins: { decrement: coupon.coinCost } },
      }),
      prisma.coupon.update({
        where: { id: couponId },
        data: { claimedCount: { increment: 1 } },
      }),
    ]);

    res.status(201).json({
      userCoupon,
      message: 'Coupon claimed successfully!',
      coinsSpent: coupon.coinCost,
    });
  } catch (error) {
    console.error('Claim coupon error:', error);
    res.status(500).json({ error: 'Failed to claim coupon' });
  }
});

// POST /coupons/:id/use - Mark coupon as used
router.post('/:id/use', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: userCouponId } = req.params as { id: string };
    const userId = req.user!.userId;

    const userCoupon = await prisma.userCoupon.findFirst({
      where: { id: userCouponId, userId },
    });

    if (!userCoupon) {
      res.status(404).json({ error: 'Coupon not found' });
      return;
    }

    if (userCoupon.status !== 'active') {
      res.status(400).json({ error: 'Coupon already used or expired' });
      return;
    }

    await prisma.userCoupon.update({
      where: { id: userCouponId },
      data: {
        status: 'used',
        usedAt: new Date(),
      },
    });

    res.json({ message: 'Coupon marked as used' });
  } catch (error) {
    console.error('Use coupon error:', error);
    res.status(500).json({ error: 'Failed to use coupon' });
  }
});

export default router;

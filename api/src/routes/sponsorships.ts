// @ts-nocheck
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /sponsorships - Get all active flash sponsorships
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sponsorships = await prisma.flashSponsorship.findMany({
      where: {
        isActive: true,
        endsAt: { gt: new Date() },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            coverImage: true,
            city: true,
          },
        },
        _count: {
          select: {
            drops: true,
          },
        },
      },
      orderBy: { endsAt: 'asc' },
    });

    // Check if user has participated
    let userDrops: Record<string, number> = {};
    if (req.user) {
      const drops = await prisma.flashSponsorshipDrop.groupBy({
        by: ['sponsorshipId'],
        where: { userId: req.user.userId },
        _count: { id: true },
      });
      userDrops = drops.reduce((acc, d) => {
        acc[d.sponsorshipId] = d._count.id;
        return acc;
      }, {} as Record<string, number>);
    }

    const sponsorshipsWithProgress = sponsorships.map((s) => ({
      ...s,
      progress: Math.round((s.currentDrops / s.targetDrops) * 100),
      dropsRemaining: s.targetDrops - s.currentDrops,
      userDropCount: userDrops[s.id] || 0,
      timeRemaining: s.endsAt.getTime() - Date.now(),
    }));

    res.json({ sponsorships: sponsorshipsWithProgress });
  } catch (error) {
    console.error('Get sponsorships error:', error);
    res.status(500).json({ error: 'Failed to get sponsorships' });
  }
});

// GET /sponsorships/:id - Get single sponsorship details
router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const sponsorship = await prisma.flashSponsorship.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            coverImage: true,
            address: true,
            city: true,
            state: true,
            cuisineTypes: true,
          },
        },
        drops: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profileImage: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            drops: true,
          },
        },
      },
    });

    if (!sponsorship) {
      res.status(404).json({ error: 'Sponsorship not found' });
      return;
    }

    // Get top contributors
    const topContributors = await prisma.flashSponsorshipDrop.groupBy({
      by: ['userId'],
      where: { sponsorshipId: sponsorship.id },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const contributorIds = topContributors.map((c) => c.userId);
    const contributors = await prisma.user.findMany({
      where: { id: { in: contributorIds } },
      select: {
        id: true,
        username: true,
        name: true,
        profileImage: true,
      },
    });

    const topContributorsWithInfo = topContributors.map((c) => ({
      ...contributors.find((u) => u.id === c.userId),
      dropCount: c._count.id,
    }));

    // Check user participation
    let userDropCount = 0;
    if (req.user) {
      userDropCount = await prisma.flashSponsorshipDrop.count({
        where: {
          sponsorshipId: sponsorship.id,
          userId: req.user.userId,
        },
      });
    }

    res.json({
      sponsorship: {
        ...sponsorship,
        progress: Math.round((sponsorship.currentDrops / sponsorship.targetDrops) * 100),
        dropsRemaining: sponsorship.targetDrops - sponsorship.currentDrops,
        userDropCount,
        topContributors: topContributorsWithInfo,
      },
    });
  } catch (error) {
    console.error('Get sponsorship error:', error);
    res.status(500).json({ error: 'Failed to get sponsorship' });
  }
});

// POST /sponsorships/:id/drop - Record a drop for a sponsorship
// This is called automatically when posting at a sponsored restaurant
router.post('/:id/drop', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: sponsorshipId } = req.params as { id: string };
    const userId = req.user!.userId;
    const { postId } = req.body;

    const sponsorship = await prisma.flashSponsorship.findUnique({
      where: { id: sponsorshipId },
    });

    if (!sponsorship) {
      res.status(404).json({ error: 'Sponsorship not found' });
      return;
    }

    if (!sponsorship.isActive || sponsorship.endsAt < new Date()) {
      res.status(400).json({ error: 'Sponsorship is no longer active' });
      return;
    }

    // Check if already dropped for this post
    if (postId) {
      const existingDrop = await prisma.flashSponsorshipDrop.findFirst({
        where: { sponsorshipId, userId, postId },
      });

      if (existingDrop) {
        res.status(400).json({ error: 'Already counted for this post' });
        return;
      }
    }

    // Create drop and update count
    const [drop] = await prisma.$transaction([
      prisma.flashSponsorshipDrop.create({
        data: {
          sponsorshipId,
          userId,
          postId,
        },
      }),
      prisma.flashSponsorship.update({
        where: { id: sponsorshipId },
        data: { currentDrops: { increment: 1 } },
      }),
    ]);

    // Check if goal was just reached
    const updatedSponsorship = await prisma.flashSponsorship.findUnique({
      where: { id: sponsorshipId },
    });

    let goalReached = false;
    if (updatedSponsorship && updatedSponsorship.currentDrops >= updatedSponsorship.targetDrops && !updatedSponsorship.isCompleted) {
      // Mark as completed and record donation
      await prisma.flashSponsorship.update({
        where: { id: sponsorshipId },
        data: {
          isCompleted: true,
          totalMealsDonated: updatedSponsorship.totalMealsPledged,
        },
      });

      // Update global stats
      await prisma.globalStats.update({
        where: { id: 'global' },
        data: {
          totalMeals: { increment: updatedSponsorship.totalMealsPledged },
        },
      });

      goalReached = true;
    }

    res.status(201).json({
      drop,
      goalReached,
      message: goalReached
        ? `🎉 Goal reached! ${updatedSponsorship?.totalMealsPledged} meals will be donated!`
        : 'Drop recorded! Keep going!',
    });
  } catch (error) {
    console.error('Record drop error:', error);
    res.status(500).json({ error: 'Failed to record drop' });
  }
});

// GET /sponsorships/restaurant/:restaurantId - Get active sponsorships for a restaurant
router.get('/restaurant/:restaurantId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params as { restaurantId: string };
    const sponsorships = await prisma.flashSponsorship.findMany({
      where: {
        restaurantId,
        isActive: true,
        endsAt: { gt: new Date() },
      },
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
    });

    res.json({
      sponsorships: sponsorships.map((s) => ({
        ...s,
        progress: Math.round((s.currentDrops / s.targetDrops) * 100),
        dropsRemaining: s.targetDrops - s.currentDrops,
      })),
    });
  } catch (error) {
    console.error('Get restaurant sponsorships error:', error);
    res.status(500).json({ error: 'Failed to get sponsorships' });
  }
});

export default router;

// @ts-nocheck
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /teams - List all teams
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, search, cursor, limit = '20' } = req.query as {
      type?: string;
      search?: string;
      cursor?: string;
      limit?: string;
    };

    let whereClause: Record<string, unknown> = {};

    if (type) {
      whereClause = { ...whereClause, type: type as string };
    }

    if (search) {
      whereClause = {
        ...whereClause,
        name: { contains: search as string, mode: 'insensitive' },
      };
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      orderBy: { totalMeals: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        logoUrl: true,
        memberCount: true,
        totalMeals: true,
        currentGoal: true,
      },
    });

    const hasMore = teams.length > parseInt(limit as string);
    if (hasMore) teams.pop();

    res.json({
      teams,
      nextCursor: hasMore ? teams[teams.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

// GET /teams/leaderboard - Get team leaderboard
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, limit = '20' } = req.query as { type?: string; limit?: string };

    let whereClause: Record<string, unknown> = {};

    if (type) {
      whereClause = { type: type as string };
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      orderBy: { totalMeals: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        logoUrl: true,
        memberCount: true,
        totalMeals: true,
        currentGoal: true,
      },
    });

    const leaderboard = teams.map((team, index) => ({
      ...team,
      rank: index + 1,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get team leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /teams/:teamId - Get team details
router.get('/:teamId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };

    // Try by ID first, then by slug
    let team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      team = await prisma.team.findUnique({
        where: { slug: teamId },
      });
    }

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Get top members
    const topMembers = await prisma.user.findMany({
      where: { teamId: team.id },
      orderBy: { mealsDonated: 'desc' },
      take: 5,
      select: {
        id: true,
        username: true,
        name: true,
        profileImage: true,
        mealsDonated: true,
      },
    });

    res.json({
      team,
      topMembers,
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to get team' });
  }
});

// GET /teams/:teamId/members - Get team members
router.get('/:teamId/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const members = await prisma.user.findMany({
      where: { teamId },
      orderBy: { mealsDonated: 'desc' },
      take: parseInt(limit as string) + 1,
      ...(cursor ? { cursor: { id: cursor as string }, skip: 1 } : {}),
      select: {
        id: true,
        username: true,
        name: true,
        profileImage: true,
        mealsDonated: true,
        mealStreak: true,
        postCount: true,
      },
    });

    const hasMore = members.length > parseInt(limit as string);
    if (hasMore) members.pop();

    res.json({
      members: members.map((m, i) => ({ ...m, rank: i + 1 })),
      nextCursor: hasMore ? members[members.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// POST /teams/:teamId/join - Join a team
router.post('/:teamId/join', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };
    const userId = req.user!.userId;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true, mealsDonated: true },
    });

    if (user?.teamId === teamId) {
      res.status(400).json({ error: 'Already a member of this team' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Leave current team if any
      if (user?.teamId) {
        await tx.team.update({
          where: { id: user.teamId },
          data: {
            memberCount: { decrement: 1 },
            totalMeals: { decrement: user.mealsDonated },
          },
        });
      }

      // Join new team
      await tx.user.update({
        where: { id: userId },
        data: { teamId },
      });

      await tx.team.update({
        where: { id: teamId },
        data: {
          memberCount: { increment: 1 },
          totalMeals: { increment: user?.mealsDonated || 0 },
        },
      });
    });

    res.json({ message: 'Joined team successfully' });
  } catch (error) {
    console.error('Join team error:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

// DELETE /teams/:teamId/leave - Leave a team
router.delete('/:teamId/leave', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string };
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true, mealsDonated: true },
    });

    if (user?.teamId !== teamId) {
      res.status(400).json({ error: 'Not a member of this team' });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { teamId: null },
      }),
      prisma.team.update({
        where: { id: teamId },
        data: {
          memberCount: { decrement: 1 },
          totalMeals: { decrement: user.mealsDonated },
        },
      }),
    ]);

    res.json({ message: 'Left team successfully' });
  } catch (error) {
    console.error('Leave team error:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  name: z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { email, password, username, name } = validation.data;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      res.status(400).json({ error: 'Username already taken' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        name,
        termsAcceptedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        profileImage: true,
        mealsDonated: true,
        postCount: true,
        mealStreak: true,
        mealsBalance: true,
        createdAt: true,
      },
    });

    // Create default collections
    await prisma.collection.createMany({
      data: [
        { userId: user.id, name: 'Favorites', isDefault: true, isPublic: false },
        { userId: user.id, name: 'To Try', isDefault: true, isPublic: false },
      ],
    });

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const { email, password } = validation.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        username: true,
        name: true,
        bio: true,
        profileImage: true,
        teamId: true,
        mealsDonated: true,
        postCount: true,
        mealStreak: true,
        mealsBalance: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /auth/me - Get current user
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        profileImage: true,
        teamId: true,
        latitude: true,
        longitude: true,
        city: true,
        mealsDonated: true,
        postCount: true,
        mealStreak: true,
        mealsBalance: true,
        isPrivate: true,
        pushEnabled: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            type: true,
          },
        },
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
            collections: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /auth/logout - Client-side only, but endpoint for consistency
router.post('/logout', authMiddleware, (_req: Request, res: Response): void => {
  // JWT is stateless, so logout is handled client-side by removing the token
  res.json({ message: 'Logged out successfully' });
});

// PUT /auth/update-location - Update user location
router.put('/update-location', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, city } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Invalid location data' });
      return;
    }

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { latitude, longitude, city },
    });

    res.json({ message: 'Location updated' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /auth/account - Delete user account and all data
router.delete('/account', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete user — most relations cascade via onDelete: Cascade
    // But some models don't have direct cascade, so delete them explicitly
    await prisma.$transaction([
      prisma.report.deleteMany({ where: { reporterId: userId } }),
      prisma.blockedUser.deleteMany({
        where: { OR: [{ userId }, { blockedId: userId }] },
      }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;

import express from 'express';
import cors from 'cors';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import postRoutes from './routes/posts';
import restaurantRoutes from './routes/restaurants';
import collectionRoutes from './routes/collections';
import impactRoutes from './routes/impact';
import teamRoutes from './routes/teams';
import searchRoutes from './routes/search';
import couponRoutes from './routes/coupons';
import sponsorshipRoutes from './routes/sponsorships';
import dashboardRoutes from './routes/dashboard';
import moderationRoutes from './routes/moderation';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/sponsorships', sponsorshipRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/moderation', moderationRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Only start listening when not in Vercel serverless
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Dish Drop API running on http://localhost:${PORT}`);
  });
}

export default app;

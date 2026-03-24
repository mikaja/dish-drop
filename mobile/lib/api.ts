import { API_URL, StorageKeys } from './constants';
import { safeGetItem } from './storage';
import type {
  User,
  Post,
  Restaurant,
  RestaurantMenu,
  Collection,
  Team,
  Comment,
  GlobalStats,
  PersonalStats,
  Achievement,
  SearchResults,
  LeaderboardEntry,
  TeamLeaderboardEntry,
  CreatePostData,
  CreateCollectionData,
  UpdateProfileData,
  FeedFilters,
  RestaurantFilters,
  Category,
  Coupon,
  UserCoupon,
  FlashSponsorship,
  FlashSponsorshipDrop,
  UserPreview,
  MysteryBox,
  TrendingDish,
  SponsoredPost,
} from '../types';
import {
  mockPosts,
  mockRestaurants,
  mockUsers,
  mockGlobalStats,
  mockPersonalStats,
  mockCollections,
  mockLeaderboard,
  mockAchievements,
  mockCategories,
  getMenuForRestaurant,
} from './mockData';

// Inline mock data for features not yet in mockData.ts
const COIN_THRESHOLDS = [5, 15, 30, 50] as const;

const mockCoupons: Coupon[] = [
  {
    id: 'coupon-1',
    restaurantId: mockRestaurants[0]?.id || 'r1',
    restaurant: { id: mockRestaurants[0]?.id || 'r1', name: mockRestaurants[0]?.name || 'Local Restaurant' },
    title: '10% Off Your Order',
    description: 'Valid on orders over $20',
    discountType: 'percentage',
    discountValue: 10,
    coinCost: 10,
    originalValue: '$5',
    claimedCount: 42,
    isActive: true,
    expiresAt: '2026-03-31T00:00:00Z',
    isRedeemed: false,
    imageUrl: mockRestaurants[0]?.coverImage,
  },
  {
    id: 'coupon-2',
    restaurantId: mockRestaurants[1]?.id || 'r2',
    restaurant: { id: mockRestaurants[1]?.id || 'r2', name: mockRestaurants[1]?.name || 'Pizza Place' },
    title: 'Free Appetizer',
    description: 'Any appetizer up to $12',
    discountType: 'freeItem',
    discountValue: 12,
    coinCost: 25,
    originalValue: '$12',
    claimedCount: 18,
    isActive: true,
    expiresAt: '2026-03-31T00:00:00Z',
    isRedeemed: false,
    imageUrl: mockRestaurants[1]?.coverImage,
  },
];

const mockFlashSponsorship: FlashSponsorship = {
  id: 'sponsor-1',
  restaurantId: mockRestaurants[0]?.id || 'r1',
  restaurant: { id: mockRestaurants[0]?.id || 'r1', name: mockRestaurants[0]?.name || 'Local Restaurant' },
  title: "Valentine's Day Challenge",
  description: 'Post a dish from any local restaurant and we\'ll donate a meal for every 3 drops!',
  bannerImageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  targetDrops: 200,
  currentDrops: 73,
  mealsToDonatePer: 1,
  bonusMeals: 50,
  totalMealsPledged: 250,
  totalMealsDonated: 187,
  dropsRequired: 200,
  totalMealsGoal: 500,
  currentMeals: 187,
  startsAt: '2026-02-10T00:00:00Z',
  endsAt: '2026-02-28T00:00:00Z',
  isActive: true,
  isCompleted: false,
};

const mockMysteryBox: MysteryBox = {
  id: 'mystery-1',
  date: '2026-02-19',
  sponsorRestaurant: { id: mockRestaurants[3]?.id || 'r4', name: mockRestaurants[3]?.name || 'Restaurant' },
  reward: '15% Off Next Order',
  rewardDescription: 'Valid at any participating restaurant today',
  isOpened: false,
  expiresAt: '2026-02-20T00:00:00Z',
};

const mockTrendingDishes: TrendingDish[] = mockPosts.slice(0, 8).map((post, i) => ({
  id: `trend-dish-${i}`,
  dishName: post.caption?.split(' ').slice(0, 3).join(' ') || 'Trending Dish',
  imageUrl: post.imageUrl,
  restaurantName: post.restaurant?.name || 'Restaurant',
  restaurantId: post.restaurantId || mockRestaurants[i]?.id || `r${i}`,
  postCount: Math.floor(Math.random() * 50) + 10,
  averageRating: 7 + Math.random() * 3,
}));

const mockSponsoredPost: SponsoredPost = {
  id: 'sponsored-1',
  restaurantId: mockRestaurants[5]?.id || 'r6',
  restaurant: { id: mockRestaurants[5]?.id || 'r6', name: mockRestaurants[5]?.name || 'Featured Spot' },
  imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  title: 'Try Our New Spring Menu',
  subtitle: 'Fresh seasonal dishes crafted by our award-winning chef',
  ctaText: 'Order Now',
  ctaUrl: 'https://example.com',
  isSponsored: true,
};

const mockCommunityCollections: Collection[] = [
  {
    id: 'feat-1',
    userId: mockUsers[1]?.id || 'u2',
    user: { id: mockUsers[1]?.id || 'u2', username: 'eagle_eater', name: 'James O\'Brien', profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150' },
    name: 'Best Late Night Eats Near BC',
    description: 'Open past midnight when you need fuel for that all-nighter',
    coverImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 18,
    previewImages: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200',
    ],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-2',
    userId: mockUsers[4]?.id || 'u5',
    user: { id: mockUsers[4]?.id || 'u5', username: 'burger_baron', name: 'Nick Russo', profileImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150' },
    name: 'Top Burgers in Boston',
    description: 'The juiciest, most stacked burgers from Allston to Back Bay',
    coverImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 24,
    previewImages: [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
      'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200',
      'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200',
    ],
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-3',
    userId: mockUsers[3]?.id || 'u4',
    user: { id: mockUsers[3]?.id || 'u4', username: 'brunch_boss', name: 'Sarah Kim', profileImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150' },
    name: 'Date Night Spots',
    description: 'Romantic restaurants perfect for impressing your special someone',
    coverImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 15,
    previewImages: [
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200',
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=200',
    ],
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-4',
    userId: mockUsers[5]?.id || 'u6',
    user: { id: mockUsers[5]?.id || 'u6', username: 'bc_eats', name: 'Alex Taylor', profileImage: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150' },
    name: 'Cheap Eats Under $10',
    description: 'Delicious meals that won\'t break the college budget',
    coverImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 31,
    previewImages: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200',
      'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=200',
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=200',
    ],
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'feat-5',
    userId: mockUsers[6]?.id || 'u7',
    user: { id: mockUsers[6]?.id || 'u7', username: 'newton_native', name: 'Rachel Green', profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' },
    name: 'Hidden Gems of Brookline',
    description: 'Underrated spots the locals swear by',
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 12,
    previewImages: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200',
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=200',
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=200',
    ],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend-1',
    userId: mockUsers[2]?.id || 'u3',
    user: { id: mockUsers[2]?.id || 'u3', username: 'noodle_ninja', name: 'David Wang', profileImage: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150' },
    name: 'Ramen Rankings',
    description: 'The best ramen spots ranked from good to life-changing',
    coverImage: 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 14,
    previewImages: [
      'https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=200',
      'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200',
      'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=200',
    ],
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend-2',
    userId: mockUsers[3]?.id || 'u4',
    user: { id: mockUsers[3]?.id || 'u4', username: 'brunch_boss', name: 'Sarah Kim', profileImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150' },
    name: 'Best Brunch Spots',
    description: 'Weekend brunch destinations worth waking up for',
    coverImage: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 20,
    previewImages: [
      'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=200',
      'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=200',
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=200',
    ],
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend-3',
    userId: mockUsers[0]?.id || 'u1',
    user: { id: mockUsers[0]?.id || 'u1', username: 'spice_lover', name: 'Aisha Mohammed', profileImage: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150' },
    name: 'Spice Trail: Hottest Dishes',
    description: 'For those who like it hot — the spiciest dishes around BC',
    coverImage: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 17,
    previewImages: [
      'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=200',
      'https://images.unsplash.com/photo-1574484284002-952d92456975?w=200',
      'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=200',
    ],
    createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend-4',
    userId: mockUsers[10]?.id || 'u11',
    user: { id: mockUsers[10]?.id || 'u11', username: 'sofiasnacks', name: 'Sofia Rodriguez', profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200' },
    name: 'Study Cafe Vibes',
    description: 'Cozy cafes perfect for studying with great coffee and snacks',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 11,
    previewImages: [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200',
    ],
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend-5',
    userId: mockUsers[8]?.id || 'u9',
    user: { id: mockUsers[8]?.id || 'u9', username: 'chef_mike', name: 'Mike Patterson', profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' },
    name: 'Pizza Pilgrimage',
    description: 'Every pizza place worth visiting near campus',
    coverImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 16,
    previewImages: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=200',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200',
    ],
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'trend-6',
    userId: mockUsers[9]?.id || 'u10',
    user: { id: mockUsers[9]?.id || 'u10', username: 'dessert_diva', name: 'Lily Zhang', profileImage: 'https://images.unsplash.com/photo-1502767089025-6572583d8c40?w=150' },
    name: 'Dessert Heaven',
    description: 'Sweet treats, bakeries, and dessert spots you can\'t miss',
    coverImage: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600',
    isPublic: true,
    isDefault: false,
    itemCount: 22,
    previewImages: [
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200',
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200',
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=200',
    ],
    createdAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Enable mock mode for demos
const USE_MOCK_DATA = true;

// Mock current user for demo mode
const MOCK_CURRENT_USER: User = {
  id: 'current-user',
  email: 'demo@dishdrop.app',
  username: 'dishdrop_user',
  name: 'DishDrop User',
  bio: 'Food explorer near Boston College',
  profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  mealsDonated: 47,
  postCount: 12,
  mealStreak: 7,
  mealsBalance: 5,
  coins: 23,
  totalCoins: 38,
  isPrivate: false,
  pushEnabled: true,
  createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  _count: {
    followers: 84,
    following: 127,
    posts: 12,
    collections: 4,
  },
};

const MOCK_TOKEN = 'mock-jwt-token-dishdrop-demo';

// API client with authentication
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await safeGetItem(StorageKeys.AUTH_TOKEN);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    username: string;
    name: string;
  }): Promise<{ user: User; token: string }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const user = { ...MOCK_CURRENT_USER, email: data.email, username: data.username, name: data.name };
      return { user, token: MOCK_TOKEN };
    }
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { user: MOCK_CURRENT_USER, token: MOCK_TOKEN };
    }
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<{ user: User }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { user: MOCK_CURRENT_USER };
    }
    return this.request('/auth/me');
  }

  async updateLocation(data: {
    latitude: number;
    longitude: number;
    city?: string;
  }): Promise<void> {
    if (USE_MOCK_DATA) {
      return;
    }
    return this.request('/auth/update-location', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // User endpoints
  async getUser(userId: string): Promise<{ user: User }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (userId === 'current-user') {
        return { user: MOCK_CURRENT_USER };
      }
      // Find in mockUsers and convert to full User
      const mockUser = mockUsers.find((u: any) => u.id === userId);
      if (mockUser) {
        const fullUser: User = {
          id: mockUser.id,
          email: `${mockUser.username}@dishdrop.app`,
          username: mockUser.username,
          name: mockUser.name,
          profileImage: mockUser.profileImage,
          mealsDonated: mockUser.mealsDonated || 0,
          postCount: mockPosts.filter(p => p.user?.id === mockUser.id).length,
          mealStreak: mockUser.mealStreak || 0,
          mealsBalance: 3,
          coins: 15,
          totalCoins: 30,
          isPrivate: false,
          pushEnabled: true,
          createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
          _count: {
            followers: Math.floor(Math.random() * 200) + 20,
            following: Math.floor(Math.random() * 150) + 30,
            posts: mockPosts.filter(p => p.user?.id === mockUser.id).length,
            collections: 2,
          },
        };
        return { user: fullUser };
      }
      throw new Error('User not found');
    }
    return this.request(`/users/${userId}`);
  }

  async updateUser(userId: string, data: UpdateProfileData): Promise<{ user: User }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { user: { ...MOCK_CURRENT_USER, ...data } };
    }
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserPosts(
    userId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ posts: Post[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const userPosts = userId === 'current-user'
        ? mockPosts.slice(0, 5)
        : mockPosts.filter(p => p.user?.id === userId).slice(0, limit);
      return { posts: userPosts, nextCursor: null };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/users/${userId}/posts?${params}`);
  }

  async getUserLikes(
    userId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ likes: Post[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { likes: mockPosts.slice(2, 8), nextCursor: null };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/users/${userId}/likes?${params}`);
  }

  async getFollowers(
    userId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ followers: User[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/users/${userId}/followers?${params}`);
  }

  async getFollowing(
    userId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ following: User[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/users/${userId}/following?${params}`);
  }

  async followUser(userId: string): Promise<void> {
    return this.request(`/users/${userId}/follow`, { method: 'POST' });
  }

  async unfollowUser(userId: string): Promise<void> {
    return this.request(`/users/${userId}/follow`, { method: 'DELETE' });
  }

  // Post endpoints
  async getPosts(
    filters: FeedFilters = {},
    cursor?: string,
    limit = 20
  ): Promise<{ posts: Post[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return { posts: mockPosts, nextCursor: null };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (filters.feed) params.append('feed', filters.feed);
    if (filters.lat) params.append('lat', String(filters.lat));
    if (filters.lng) params.append('lng', String(filters.lng));
    if (filters.radius) params.append('radius', String(filters.radius));
    if (filters.cuisineType) params.append('cuisineType', filters.cuisineType);
    if (cursor) params.append('cursor', cursor);
    return this.request(`/posts?${params}`);
  }

  async getPost(postId: string): Promise<{ post: Post }> {
    return this.request(`/posts/${postId}`);
  }

  async createPost(data: CreatePostData): Promise<{ post: Post }> {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePost(postId: string): Promise<void> {
    return this.request(`/posts/${postId}`, { method: 'DELETE' });
  }

  async likePost(postId: string): Promise<void> {
    return this.request(`/posts/${postId}/like`, { method: 'POST' });
  }

  async unlikePost(postId: string): Promise<void> {
    return this.request(`/posts/${postId}/like`, { method: 'DELETE' });
  }

  async savePost(postId: string, collectionId?: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return;
    }
    return this.request(`/posts/${postId}/save`, {
      method: 'POST',
      body: JSON.stringify({ collectionId }),
    });
  }

  async unsavePost(postId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return;
    }
    return this.request(`/posts/${postId}/save`, { method: 'DELETE' });
  }

  async getComments(
    postId: string,
    cursor?: string,
    limit = 50
  ): Promise<{ comments: Comment[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/posts/${postId}/comments?${params}`);
  }

  async addComment(
    postId: string,
    content: string,
    parentId?: string
  ): Promise<{ comment: Comment }> {
    return this.request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
  }

  // Restaurant endpoints
  async getRestaurants(
    filters: RestaurantFilters = {},
    cursor?: string,
    limit = 20
  ): Promise<{ restaurants: Restaurant[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { restaurants: mockRestaurants.slice(0, limit), nextCursor: null };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (filters.lat) params.append('lat', String(filters.lat));
    if (filters.lng) params.append('lng', String(filters.lng));
    if (filters.radius) params.append('radius', String(filters.radius));
    if (filters.cuisine) params.append('cuisine', filters.cuisine);
    if (filters.priceLevel) params.append('priceLevel', String(filters.priceLevel));
    if (filters.search) params.append('search', filters.search);
    if (cursor) params.append('cursor', cursor);
    return this.request(`/restaurants?${params}`);
  }

  async getNearbyRestaurants(
    lat: number,
    lng: number,
    limit = 10
  ): Promise<{ restaurants: Restaurant[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      // Sort restaurants by distance from user's location
      const sorted = [...mockRestaurants].sort((a, b) => {
        const distA = Math.hypot(a.latitude - lat, a.longitude - lng);
        const distB = Math.hypot(b.latitude - lat, b.longitude - lng);
        return distA - distB;
      });
      return { restaurants: sorted.slice(0, limit) };
    }
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      limit: String(limit),
    });
    return this.request(`/restaurants/nearby?${params}`);
  }

  async getRestaurant(restaurantId: string): Promise<{ restaurant: Restaurant }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const restaurant = mockRestaurants.find(r => r.id === restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');
      // Populate website URL from slug for demo mode
      const withWebsite = {
        ...restaurant,
        website: restaurant.website || `https://${restaurant.slug}.example.com`,
      };
      return { restaurant: withWebsite };
    }
    return this.request(`/restaurants/${restaurantId}`);
  }

  async getRestaurantPosts(
    restaurantId: string,
    sort = 'recent',
    cursor?: string,
    limit = 20
  ): Promise<{ posts: Post[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const posts = mockPosts.filter(p => p.restaurantId === restaurantId);
      return { posts, nextCursor: null };
    }
    const params = new URLSearchParams({ sort, limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/restaurants/${restaurantId}/posts?${params}`);
  }

  async getRestaurantMenu(restaurantId: string): Promise<{ menu: RestaurantMenu }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const restaurant = mockRestaurants.find(r => r.id === restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');
      return { menu: getMenuForRestaurant(restaurant) };
    }
    return this.request(`/restaurants/${restaurantId}/menu`);
  }

  async createRestaurant(data: Partial<Restaurant>): Promise<{ restaurant: Restaurant }> {
    return this.request('/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Collection endpoints
  async getCollections(): Promise<{ collections: Collection[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { collections: mockCollections };
    }
    return this.request('/collections');
  }

  async getPublicCollections(
    userId?: string,
    cursor?: string,
    limit = 20
  ): Promise<{ collections: Collection[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      let collections = [...mockCollections.filter(c => c.isPublic), ...mockCommunityCollections];
      if (userId) {
        collections = collections.filter(c => c.userId === userId);
      }
      return { collections: collections.slice(0, limit), nextCursor: null };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (userId) params.append('userId', userId);
    if (cursor) params.append('cursor', cursor);
    return this.request(`/collections/public?${params}`);
  }

  async getCollection(
    collectionId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ collection: Collection; items: Post[]; nextCursor: string | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const collection = mockCollections.find(c => c.id === collectionId)
        || mockCommunityCollections.find(c => c.id === collectionId);
      if (!collection) throw new Error('Collection not found');
      // Return varied posts based on collection to make each feel unique
      const offset = Math.abs(collectionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % Math.max(1, mockPosts.length - limit);
      const items = mockPosts.slice(offset, offset + Math.min(limit, collection.itemCount));
      return { collection, items, nextCursor: null };
    }

    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/collections/${collectionId}?${params}`);
  }

  async createCollection(data: CreateCollectionData): Promise<{ collection: Collection }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const newCollection: Collection = {
        id: `coll-${Date.now()}`,
        userId: 'current-user',
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? true,
        isDefault: false,
        itemCount: 0,
        previewImages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { collection: newCollection };
    }
    return this.request('/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCollection(
    collectionId: string,
    data: Partial<CreateCollectionData>
  ): Promise<{ collection: Collection }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const existing = mockCollections.find(c => c.id === collectionId)
        || mockCommunityCollections.find(c => c.id === collectionId);
      if (!existing) throw new Error('Collection not found');
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
      return { collection: updated };
    }
    return this.request(`/collections/${collectionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCollection(collectionId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return;
    }
    return this.request(`/collections/${collectionId}`, { method: 'DELETE' });
  }

  async addToCollection(collectionId: string, postId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return;
    }
    return this.request(`/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ postId }),
    });
  }

  async removeFromCollection(collectionId: string, postId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return;
    }
    return this.request(`/collections/${collectionId}/items/${postId}`, {
      method: 'DELETE',
    });
  }

  // Impact endpoints
  async getGlobalStats(): Promise<{ stats: GlobalStats }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { stats: mockGlobalStats };
    }
    return this.request('/impact/global');
  }

  async getPersonalStats(): Promise<{
    stats: PersonalStats;
    team: Team | null;
    achievements: Achievement[];
  }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        stats: mockPersonalStats,
        team: {
          id: 'team-bc',
          name: 'Boston College',
          slug: 'boston-college',
          type: 'university',
          logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Boston_College_Eagles_logo.svg/150px-Boston_College_Eagles_logo.svg.png',
          city: 'Chestnut Hill',
          state: 'MA',
          memberCount: 1234,
          totalMeals: 45678,
          currentGoal: 50000,
        },
        achievements: mockAchievements.slice(0, 3),
      };
    }
    return this.request('/impact/personal');
  }

  async makeDonation(
    mealCount: number,
    stripePaymentId?: string
  ): Promise<{ message: string; mealCount: number; amount: number }> {
    return this.request('/impact/donations', {
      method: 'POST',
      body: JSON.stringify({ mealCount, stripePaymentId }),
    });
  }

  async getDonationHistory(
    cursor?: string,
    limit = 20
  ): Promise<{ donations: any[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/impact/donations?${params}`);
  }

  async getFriendsLeaderboard(limit = 10): Promise<{ leaderboard: LeaderboardEntry[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { leaderboard: mockLeaderboard.slice(0, limit) };
    }
    return this.request(`/impact/leaderboard/friends?limit=${limit}`);
  }

  async getGlobalLeaderboard(limit = 50): Promise<{ leaderboard: LeaderboardEntry[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { leaderboard: mockLeaderboard.slice(0, limit) };
    }
    return this.request(`/impact/leaderboard/global?limit=${limit}`);
  }

  async getAllAchievements(): Promise<{ achievements: Achievement[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { achievements: mockAchievements };
    }
    return this.request('/impact/achievements');
  }

  // Team endpoints
  async getTeams(
    type?: string,
    search?: string,
    cursor?: string,
    limit = 20
  ): Promise<{ teams: Team[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) params.append('type', type);
    if (search) params.append('search', search);
    if (cursor) params.append('cursor', cursor);
    return this.request(`/teams?${params}`);
  }

  async getTeamLeaderboard(
    type?: string,
    limit = 20
  ): Promise<{ leaderboard: TeamLeaderboardEntry[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) params.append('type', type);
    return this.request(`/teams/leaderboard?${params}`);
  }

  async getTeam(teamId: string): Promise<{ team: Team; topMembers: User[] }> {
    return this.request(`/teams/${teamId}`);
  }

  async getTeamMembers(
    teamId: string,
    cursor?: string,
    limit = 20
  ): Promise<{ members: User[]; nextCursor: string | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return this.request(`/teams/${teamId}/members?${params}`);
  }

  async joinTeam(teamId: string): Promise<void> {
    return this.request(`/teams/${teamId}/join`, { method: 'POST' });
  }

  async leaveTeam(teamId: string): Promise<void> {
    return this.request(`/teams/${teamId}/leave`, { method: 'DELETE' });
  }

  // Search endpoints
  async search(
    query: string,
    type?: string,
    lat?: number,
    lng?: number,
    limit = 10
  ): Promise<{ results: SearchResults; query: string }> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (type) params.append('type', type);
    if (lat) params.append('lat', String(lat));
    if (lng) params.append('lng', String(lng));
    return this.request(`/search?${params}`);
  }

  async getSearchSuggestions(
    query: string
  ): Promise<{ suggestions: Array<{ type: string; text: string; slug?: string }> }> {
    return this.request(`/search/suggestions?q=${encodeURIComponent(query)}`);
  }

  async getCategories(): Promise<{ categories: Category[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { categories: mockCategories };
    }
    return this.request('/search/categories');
  }

  // Coupon endpoints (API)
  async getCoupons(restaurantId?: string): Promise<{ coupons: Coupon[]; coinBalance: number; thresholds: typeof COIN_THRESHOLDS }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        coupons: mockCoupons,
        coinBalance: mockPersonalStats.coinBalance,
        thresholds: COIN_THRESHOLDS,
      };
    }
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    return this.request(`/coupons?${params}`);
  }

  async getMyCoupons(): Promise<{ coupons: UserCoupon[] }> {
    return this.request('/coupons/mine');
  }

  async claimCoupon(couponId: string): Promise<{ userCoupon: UserCoupon; message: string; coinsSpent: number }> {
    return this.request(`/coupons/${couponId}/claim`, { method: 'POST' });
  }

  async useCoupon(userCouponId: string): Promise<{ message: string }> {
    return this.request(`/coupons/${userCouponId}/use`, { method: 'POST' });
  }

  async redeemCoupon(couponId: string): Promise<{ coupon: Coupon }> {
    return this.request(`/coupons/${couponId}/redeem`, { method: 'POST' });
  }

  // Flash Sponsorship endpoints
  async getSponsorships(): Promise<{ sponsorships: FlashSponsorship[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const now = Date.now();
      return {
        sponsorships: [
          {
            ...mockFlashSponsorship,
            progress: (mockFlashSponsorship.currentDrops / mockFlashSponsorship.targetDrops) * 100,
            timeRemaining: new Date(mockFlashSponsorship.endsAt).getTime() - now,
          },
          {
            id: 'sponsor-2',
            restaurantId: mockRestaurants[2]?.id || 'r3',
            restaurant: { id: mockRestaurants[2]?.id || 'r3', name: mockRestaurants[2]?.name || 'Sushi Spot', coverImage: mockRestaurants[2]?.coverImage },
            title: 'Spring Clean Plate Challenge',
            description: 'Post a clean plate and we donate 2 meals per drop!',
            bannerUrl: mockRestaurants[2]?.coverImage,
            targetDrops: 150,
            currentDrops: 42,
            mealsToDonatePer: 2,
            bonusMeals: 100,
            totalMealsPledged: 400,
            totalMealsDonated: 84,
            dropsRequired: 150,
            totalMealsGoal: 400,
            currentMeals: 84,
            startsAt: '2026-02-15T00:00:00Z',
            endsAt: '2026-03-15T00:00:00Z',
            isActive: true,
            isCompleted: false,
            charityName: 'Greater Boston Food Bank',
            progress: (42 / 150) * 100,
            timeRemaining: new Date('2026-03-15T00:00:00Z').getTime() - now,
          },
        ],
      };
    }
    return this.request('/sponsorships');
  }

  async getMealMatchPromo(): Promise<{ promo: { active: boolean; multiplier: number; endsAt: string; title: string; description: string; mealsMatched: number; mealsGoal: number } | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        promo: {
          active: true,
          multiplier: 2,
          endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          title: 'Double Your Impact!',
          description: 'Every meal you donate is matched 2X during this flash promo',
          mealsMatched: 847,
          mealsGoal: 2000,
        },
      };
    }
    return this.request('/sponsorships/meal-match');
  }

  async getActiveSponsorship(): Promise<{ sponsorship: FlashSponsorship | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { sponsorship: mockFlashSponsorship };
    }
    return this.request('/sponsorships/active');
  }

  async getSponsorship(sponsorshipId: string): Promise<{
    sponsorship: FlashSponsorship & {
      topContributors: Array<UserPreview & { dropCount: number }>;
      drops: FlashSponsorshipDrop[];
    };
  }> {
    return this.request(`/sponsorships/${sponsorshipId}`);
  }

  async getRestaurantSponsorships(restaurantId: string): Promise<{ sponsorships: FlashSponsorship[] }> {
    return this.request(`/sponsorships/restaurant/${restaurantId}`);
  }

  async recordSponsorshipDrop(sponsorshipId: string, postId?: string): Promise<{
    drop: FlashSponsorshipDrop;
    goalReached: boolean;
    message: string;
  }> {
    return this.request(`/sponsorships/${sponsorshipId}/drop`, {
      method: 'POST',
      body: JSON.stringify({ postId }),
    });
  }

  // Mystery Box endpoints
  async getMysteryBox(): Promise<{ mysteryBox: MysteryBox | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { mysteryBox: mockMysteryBox };
    }
    return this.request('/mystery-box/today');
  }

  async openMysteryBox(boxId: string): Promise<{ mysteryBox: MysteryBox }> {
    return this.request(`/mystery-box/${boxId}/open`, { method: 'POST' });
  }

  // Trending endpoints
  async getTrendingDishes(limit = 6): Promise<{ dishes: TrendingDish[] }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { dishes: mockTrendingDishes.slice(0, limit) };
    }
    return this.request(`/trending/dishes?limit=${limit}`);
  }

  // Sponsored content
  async getSponsoredPost(): Promise<{ sponsored: SponsoredPost | null }> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { sponsored: mockSponsoredPost };
    }
    return this.request('/sponsored/feed');
  }
}

// Export singleton instance
export const api = new ApiClient(API_URL);

export default api;

// User types
export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  bio?: string;
  profileImage?: string;
  teamId?: string;
  team?: Team;
  latitude?: number;
  longitude?: number;
  city?: string;
  mealsDonated: number;
  postCount: number;
  mealStreak: number;
  mealsBalance: number;
  coins: number;
  totalCoins: number;
  isPrivate: boolean;
  pushEnabled: boolean;
  createdAt: string;
  _count?: {
    followers: number;
    following: number;
    posts: number;
    collections: number;
  };
  isFollowing?: boolean;
}

export interface UserPreview {
  id: string;
  username: string;
  name: string;
  profileImage?: string;
  mealsDonated?: number;
  mealStreak?: number;
}

// Post types
export interface Post {
  id: string;
  userId: string;
  user: UserPreview & { mealStreak?: number };
  dishName: string;
  imageUrl: string;
  thumbnailUrl?: string;
  rating: number;
  restaurantId: string;
  restaurant: RestaurantPreview;
  caption?: string;
  price?: number;
  dietaryTags: string[];
  cuisineType?: string;
  isPrivate: boolean;
  donationMade: boolean;
  mealsDonated: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  viewCount?: number;
  createdAt: string;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface PostPreview {
  id: string;
  dishName: string;
  imageUrl: string;
  thumbnailUrl?: string;
  rating: number;
  likeCount: number;
  commentCount?: number;
  saveCount?: number;
  createdAt: string;
  restaurant: RestaurantPreview;
  user?: UserPreview;
}

// Menu types
export interface MenuItem {
  name: string;
  description?: string;
  price?: string;
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface RestaurantMenu {
  categories: MenuCategory[];
}

// Restaurant types
export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  coverImage?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  reservationUrl?: string;
  orderUrl?: string;
  menuUrl?: string;
  menu?: RestaurantMenu;
  postCount: number;
  averageRating: number;
  mealsDonated: number;
  cuisineTypes: string[];
  priceLevel?: number;
  hours?: Record<string, string>;
  isClaimed: boolean;
}

export interface RestaurantPreview {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  averageRating?: number;
  postCount?: number;
}

// Collection types
export interface Collection {
  id: string;
  userId: string;
  user?: UserPreview;
  name: string;
  description?: string;
  coverImage?: string;
  isPublic: boolean;
  isDefault: boolean;
  itemCount: number;
  previewImages?: string[];
  createdAt: string;
  updatedAt: string;
}

// Team types
export interface Team {
  id: string;
  name: string;
  slug: string;
  type: 'university' | 'city' | 'company';
  logoUrl?: string;
  city?: string;
  state?: string;
  memberCount: number;
  totalMeals: number;
  currentGoal: number;
  goalDeadline?: string;
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: UserPreview;
  content: string;
  parentId?: string;
  createdAt: string;
}

// Achievement types
export interface Achievement {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  type: 'posts' | 'donations' | 'streak' | 'social' | 'exploration';
  threshold: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  sortOrder: number;
}

export interface UserAchievement {
  id: string;
  achievementId: string;
  achievement: Achievement;
  unlockedAt: string;
}

// Donation types
export interface Donation {
  id: string;
  userId: string;
  mealCount: number;
  amount: number;
  source: 'post' | 'purchase' | 'gift' | 'reward';
  postId?: string;
  status: string;
  createdAt: string;
}

// Global stats
export interface GlobalStats {
  id: string;
  totalMeals: number;
  currentGoal: number;
  goalDeadline?: string;
  totalDonors: number;
}

// Personal stats
export interface PersonalStats {
  mealsDonated: number;
  mealsBalance: number;
  postCount: number;
  mealStreak: number;
  totalViews: number;
  restaurantsVisited: number;
  dishesSaved: number;
  coinBalance: number;
}

// Mystery Box / Daily Coupon
export interface MysteryBox {
  id: string;
  date: string;
  sponsorRestaurant: RestaurantPreview;
  reward: string;
  rewardDescription: string;
  isOpened: boolean;
  expiresAt: string;
}

// Trending Dish
export interface TrendingDish {
  id: string;
  dishName: string;
  imageUrl: string;
  restaurantName: string;
  restaurantId: string;
  postCount: number;
  averageRating: number;
}

// Sponsored Post (for nearby feed)
export interface SponsoredPost {
  id: string;
  restaurantId: string;
  restaurant: RestaurantPreview;
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl?: string;
  isSponsored: true;
}

// Category
export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl?: string;
  sortOrder: number;
}

// Search results
export interface SearchResults {
  dishes?: PostPreview[];
  restaurants?: RestaurantPreview[];
  users?: UserPreview[];
  collections?: Collection[];
}

// Leaderboard entry
export interface LeaderboardEntry extends UserPreview {
  rank: number;
  isCurrentUser?: boolean;
}

export interface TeamLeaderboardEntry extends Team {
  rank: number;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ApiError {
  error: string;
}

// Form types for creating/updating
export interface CreatePostData {
  dishName: string;
  imageUrl: string;
  thumbnailUrl?: string;
  rating: number;
  restaurantId: string;
  caption?: string;
  price?: number;
  dietaryTags?: string[];
  cuisineType?: string;
  isPrivate?: boolean;
  donateMeals?: number;
}

export interface CreateCollectionData {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateProfileData {
  name?: string;
  bio?: string;
  profileImage?: string;
  isPrivate?: boolean;
  pushEnabled?: boolean;
}

// Filter types
export interface FeedFilters {
  feed?: 'friends' | 'nearby';
  lat?: number;
  lng?: number;
  radius?: number;
  cuisineType?: string;
}

export interface RestaurantFilters {
  lat?: number;
  lng?: number;
  radius?: number;
  cuisine?: string;
  priceLevel?: number;
  search?: string;
}

// Coupon types
export interface Coupon {
  id: string;
  restaurantId: string;
  restaurant: RestaurantPreview;
  title: string;
  description?: string;
  code?: string;
  discountType: 'percentage' | 'fixed' | 'freeItem';
  discountValue: number;
  minPurchase?: number;
  coinCost: number;
  originalValue?: string;
  totalQuantity?: number;
  claimedCount: number;
  expiresAt?: string;
  isActive: boolean;
  isRedeemed?: boolean;
  imageUrl?: string;
  isClaimed?: boolean;
  remaining?: number;
}

export interface UserCoupon {
  id: string;
  couponId: string;
  coupon: Coupon;
  status: 'active' | 'used' | 'expired';
  usedAt?: string;
  expiresAt?: string;
  redemptionCode: string;
  claimedAt: string;
}

// Flash Sponsorship types
export interface FlashSponsorship {
  id: string;
  restaurantId: string;
  restaurant: RestaurantPreview & { coverImage?: string };
  title: string;
  description?: string;
  targetDrops: number;
  currentDrops: number;
  mealsToDonatePer: number;
  bonusMeals: number;
  totalMealsPledged: number;
  totalMealsDonated: number;
  dropsRequired: number;
  totalMealsGoal: number;
  currentMeals: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isCompleted: boolean;
  bannerUrl?: string;
  bannerImageUrl?: string;
  logoUrl?: string;
  charityName?: string;
  charityLogo?: string;
  progress?: number;
  dropsRemaining?: number;
  userDropCount?: number;
  timeRemaining?: number;
}

export interface FlashSponsorshipDrop {
  id: string;
  sponsorshipId: string;
  userId: string;
  user?: UserPreview;
  postId?: string;
  createdAt: string;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'achievement' | 'coupon' | 'flash_sponsorship';
  title: string;
  body: string;
  imageUrl?: string;
  actionType?: string;
  actionId?: string;
  isRead: boolean;
  createdAt: string;
}

// Report types
export interface ReportData {
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  reason: string;
  description?: string;
}

// Blocked user types
export interface BlockedUserEntry {
  id: string;
  blockedId: string;
  blocked: UserPreview;
  createdAt: string;
}

// UI Filter/Sort state types
export type ExploreSortOption = 'rating' | 'distance' | 'newest' | 'popular';
export type FeedSortOption = 'rating' | 'distance' | 'newest' | 'popular';

export interface ExploreFilterState {
  cuisines: string[];
  priceLevels: number[];
  minRating: number;
  maxDistance: number | null; // miles, null = no limit
  hasReservations: boolean;
  hasDelivery: boolean;
  sort: ExploreSortOption;
}

export interface FeedFilterState {
  cuisines: string[];
  dietaryTags: string[];
  minRating: number;
  sort: FeedSortOption;
}

export const DEFAULT_EXPLORE_FILTERS: ExploreFilterState = {
  cuisines: [],
  priceLevels: [],
  minRating: 0,
  maxDistance: null,
  hasReservations: false,
  hasDelivery: false,
  sort: 'rating',
};

export const DEFAULT_FEED_FILTERS: FeedFilterState = {
  cuisines: [],
  dietaryTags: [],
  minRating: 0,
  sort: 'newest',
};

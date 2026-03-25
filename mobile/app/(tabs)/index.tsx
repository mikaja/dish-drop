import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Dimensions,
  Image,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor, calculateDistance, type FeedType } from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import FilterModal, { countFeedFilters } from '../../components/FilterModal';
import type { Post, FlashSponsorship, MysteryBox, FeedFilterState } from '../../types';
import { format } from 'date-fns';
import { Paths, File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const POST_HEIGHT = SCREEN_HEIGHT - 180;

// Truncate long restaurant names at dashes (e.g. "El Barco – Mexican Restaurant & Tequila Bar" → "El Barco")
function truncateRestaurantName(name: string): string {
  // Split on " – " (em-dash) or " — " (long dash) with surrounding spaces
  const emDashIndex = name.indexOf(' \u2013 ');
  if (emDashIndex > 0) return name.substring(0, emDashIndex);
  const longDashIndex = name.indexOf(' \u2014 ');
  if (longDashIndex > 0) return name.substring(0, longDashIndex);
  // Split on " - " (hyphen with spaces) only if result is at least 3 chars
  const hyphenIndex = name.indexOf(' - ');
  if (hyphenIndex >= 3) return name.substring(0, hyphenIndex);
  return name;
}

interface SwipeablePostProps {
  post: Post;
  userLocation: { lat: number; lng: number } | null;
  onLike: (postId: string, isLiked: boolean) => void;
  onSave: (postId: string, isSaved: boolean) => void;
  onShare: (post: Post) => void;
}

function SwipeablePost({ post, userLocation, onLike, onSave, onShare }: SwipeablePostProps) {
  const translateX = useSharedValue(0);

  const navigateToRestaurant = () => {
    router.push(`/restaurant/${post.restaurant.id}`);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX(50)
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX > 120) {
        runOnJS(navigateToRestaurant)();
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const distance = (post.restaurant.latitude != null && post.restaurant.longitude != null && userLocation)
    ? calculateDistance(userLocation.lat, userLocation.lng, post.restaurant.latitude, post.restaurant.longitude)
    : null;

  return (
    <View style={{ width: SCREEN_WIDTH, height: POST_HEIGHT }}>
      <View style={styles.swipeHint}>
        <Ionicons name="restaurant" size={24} color={Colors.accent} />
        <Text style={styles.swipeHintText}>View Restaurant</Text>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.postContainer, animatedStyle]}>
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.postImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent']}
            style={styles.overlayGradientTop}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.overlayGradientBottom}
          />

          {/* Header: user info (left) + rating score (right) */}
          <View style={styles.topBar}>
            <Pressable
              style={styles.userInfo}
              onPress={() => router.push(`/profile/${post.user.id}`)}
            >
              <Image
                source={{ uri: post.user.profileImage || 'https://via.placeholder.com/40' }}
                style={styles.avatar}
              />
              <View>
                <View style={styles.usernameRow}>
                  <Text style={styles.username}>@{post.user.username}</Text>
                  {/* Post-specific meals donated badge - right of username */}
                  {(post.mealsDonated != null && post.mealsDonated > 0) && (
                    <View style={styles.postMealsBadge}>
                      <Ionicons name="heart" size={10} color={Colors.text} />
                      <Text style={styles.postMealsBadgeText}>{post.mealsDonated}</Text>
                    </View>
                  )}
                </View>
                {post.user.mealStreak && post.user.mealStreak > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={12} color={Colors.warning} />
                    <Text style={styles.streakText}>{post.user.mealStreak} week streak</Text>
                  </View>
                )}
                <Text style={styles.topDateText}>
                  {format(new Date(post.createdAt), 'MMM d, yyyy')}
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.ratingColumn} onPress={() => router.push(`/restaurant/${post.restaurant.id}`)}>
              <View style={[styles.ratingScoreBadge, { backgroundColor: getRatingColor(post.rating) }]}>
                <Text style={styles.ratingScoreText}>{post.rating}</Text>
              </View>
              {post.restaurant.averageRating != null && (
                <View style={styles.ddAvgBadge}>
                  <Text style={styles.ddAvgLabel}>DD</Text>
                  <Text style={styles.ddAvgValue}>{post.restaurant.averageRating.toFixed(1)}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Action buttons (right side) */}
          <View style={styles.actionButtons}>
            <Pressable
              style={styles.actionButton}
              onPress={() => onLike(post.id, post.isLiked || false)}
            >
              <Ionicons
                name={post.isLiked ? 'heart' : 'heart-outline'}
                size={28}
                color={post.isLiked ? Colors.error : Colors.text}
              />
              <Text style={styles.actionCount}>{post.likeCount}</Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={() => router.push(`/post/${post.id}`)}
            >
              <Ionicons name="chatbubble-outline" size={26} color={Colors.text} />
              <Text style={styles.actionCount}>{post.commentCount}</Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={() => onSave(post.id, post.isSaved || false)}
            >
              <Ionicons
                name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
                size={26}
                color={post.isSaved ? Colors.accent : Colors.text}
              />
              <Text style={styles.actionCount}>{post.saveCount}</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={() => onShare(post)}>
              <Ionicons name="share-outline" size={26} color={Colors.text} />
            </Pressable>
          </View>

          {/* Dish info (bottom) */}
          <View style={styles.dishInfo}>
            <Pressable onPress={() => router.push(`/restaurant/${post.restaurant.id}`)}>
              <Text style={styles.dishName} numberOfLines={1}>{post.dishName}</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`/restaurant/${post.restaurant.id}`)}
            >
              <View style={styles.restaurantRow}>
                <Ionicons name="location" size={14} color={Colors.accent} />
                <Text style={styles.restaurantName} numberOfLines={1} ellipsizeMode="tail">{truncateRestaurantName(post.restaurant.name)}</Text>
              </View>
            </Pressable>

            <View style={styles.locationRow}>
              {post.restaurant.city && (
                <Text style={styles.restaurantCity}>{post.restaurant.city}</Text>
              )}
              {distance !== null && (
                <Text style={styles.distanceText}>
                  {post.restaurant.city ? ' \u2022 ' : ''}{distance.toFixed(1)} mi away
                </Text>
              )}
            </View>

            {post.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {post.caption}
              </Text>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
  const [feedType, setFeedType] = useState<FeedType>('nearby');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sponsorship, setSponsorship] = useState<FlashSponsorship | null>(null);
  const [mysteryBox, setMysteryBox] = useState<MysteryBox | null>(null);
  const [mysteryBoxOpened, setMysteryBoxOpened] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [mealMatchPromo, setMealMatchPromo] = useState<{
    active: boolean;
    multiplier: number;
    endsAt: string;
    title: string;
    description: string;
    mealsMatched: number;
    mealsGoal: number;
  } | null>(null);
  const [feedFilters, setFeedFilters] = useState<FeedFilterState>({
    cuisines: [],
    dietaryTags: [],
    minRating: 0,
    sort: 'newest',
  });
  const activeFilterCount = countFeedFilters(feedFilters);
  const [headerHeight, setHeaderHeight] = useState(0);
  const { coords } = useLocation();
  const userLocation = coords ? { lat: coords.latitude, lng: coords.longitude } : null;

  const loadPosts = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else if (!refresh && !nextCursor) {
        setIsLoading(true);
      }

      const cursor = refresh ? undefined : nextCursor || undefined;

      // Use device's actual location if available
      const lat = userLocation?.lat;
      const lng = userLocation?.lng;

      // Only fetch posts if we have a real location
      if (!lat || !lng) {
        console.log('Waiting for device location...');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const { posts: newPosts, nextCursor: newCursor } = await api.getPosts(
        {
          feed: feedType,
          lat,
          lng,
          radius: 10000,
        },
        cursor,
        10
      );

      if (refresh) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }
      setNextCursor(newCursor);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [feedType, nextCursor, coords]);

  useEffect(() => {
    loadPosts(true);
  }, [feedType]);

  // Load posts when location coordinates become available
  useEffect(() => {
    if (coords) {
      loadPosts(true);
    }
  }, [coords]);

  useEffect(() => {
    const loadExtras = async () => {
      try {
        const [sponsorshipRes, mysteryBoxRes, couponRes] = await Promise.all([
          api.getActiveSponsorship(),
          api.getMysteryBox(),
          api.getCoupons(),
        ]);
        setSponsorship(sponsorshipRes.sponsorship);
        setMysteryBox(mysteryBoxRes.mysteryBox);
        setCoinBalance(couponRes.coinBalance);

        // Load active meal matching promo (if any)
        try {
          const promoRes = await api.getMealMatchPromo();
          if (promoRes?.promo?.active) {
            setMealMatchPromo(promoRes.promo);
          }
        } catch {
          // Promo endpoint may not exist yet — silently ignore
        }
      } catch (error) {
        console.error('Error loading extras:', error);
      }
    };
    loadExtras();
  }, []);

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await api.unlikePost(postId);
      } else {
        await api.likePost(postId);
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked: !isLiked,
                likeCount: isLiked ? p.likeCount - 1 : p.likeCount + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async (postId: string, isSaved: boolean) => {
    try {
      if (isSaved) {
        await api.unsavePost(postId);
      } else {
        await api.savePost(postId);
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isSaved: !isSaved,
                saveCount: isSaved ? p.saveCount - 1 : p.saveCount + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleShare = async (post: Post) => {
    try {
      const message = `Check out this ${post.dishName} from ${post.restaurant.name} on DishDrop! Rated ${post.rating}/10`;

      // Try to share with image
      if (post.imageUrl && await Sharing.isAvailableAsync()) {
        try {
          const file = new ExpoFile(Paths.cache, `dishdrop-share-${post.id}.jpg`);
          const response = await fetch(post.imageUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          await file.write(base64, { encoding: 'base64' });
          await Sharing.shareAsync(file.uri, {
            mimeType: 'image/jpeg',
            dialogTitle: message,
            UTI: 'public.jpeg',
          });
          return;
        } catch {
          // Fall through to text-only share
        }
      }

      // Fallback: share with image URL for preview on iOS
      const result = await Share.share({
        message,
        title: `${post.dishName} - DishDrop`,
        ...(Platform.OS === 'ios' && post.imageUrl ? { url: post.imageUrl } : {}),
      });

      if (result.action === Share.sharedAction) {
        console.log('Post shared successfully');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share post');
      console.error('Error sharing:', error);
    }
  };

  const handleOpenMysteryBox = () => {
    setMysteryBoxOpened(true);
  };

  const filteredPosts = useMemo(() => {
    let result = posts.filter((p) => {
      if (feedFilters.cuisines.length > 0 && (!p.cuisineType || !feedFilters.cuisines.includes(p.cuisineType))) {
        return false;
      }
      if (feedFilters.dietaryTags.length > 0 && !feedFilters.dietaryTags.some((t) => p.dietaryTags?.includes(t))) {
        return false;
      }
      if (feedFilters.minRating > 0 && p.rating < feedFilters.minRating) {
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      switch (feedFilters.sort) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance': {
          if (!userLocation) return 0;
          const distA = (a.restaurant.latitude != null && a.restaurant.longitude != null)
            ? calculateDistance(userLocation.lat, userLocation.lng, a.restaurant.latitude, a.restaurant.longitude)
            : Infinity;
          const distB = (b.restaurant.latitude != null && b.restaurant.longitude != null)
            ? calculateDistance(userLocation.lat, userLocation.lng, b.restaurant.latitude, b.restaurant.longitude)
            : Infinity;
          return distA - distB;
        }
        case 'popular':
          return b.likeCount - a.likeCount;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [posts, feedFilters, userLocation]);

  const snapOffsets = useMemo(() => {
    if (headerHeight === 0 || filteredPosts.length === 0) return undefined;
    const offsets: number[] = [];
    for (let i = 0; i < filteredPosts.length; i++) {
      offsets.push(headerHeight + i * POST_HEIGHT);
    }
    return offsets;
  }, [headerHeight, filteredPosts.length]);

  const renderMealMatchBanner = () => {
    if (!mealMatchPromo || !mealMatchPromo.active) return null;

    const timeLeft = new Date(mealMatchPromo.endsAt).getTime() - Date.now();
    if (timeLeft <= 0) return null;

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    const progress = (mealMatchPromo.mealsMatched / mealMatchPromo.mealsGoal) * 100;

    return (
      <Pressable
        style={styles.mealMatchBanner}
        onPress={() => router.push('/(tabs)/create')}
      >
        <LinearGradient
          colors={['#FF6B35', '#FF8F00', '#FFB300']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mealMatchGradient}
        >
          <View style={styles.mealMatchHeader}>
            <View style={styles.mealMatchLiveBadge}>
              <Ionicons name="flame" size={14} color="#fff" />
              <Text style={styles.mealMatchLiveText}>{mealMatchPromo.multiplier}X MEAL MATCH</Text>
            </View>
            <View style={styles.mealMatchTimer}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.mealMatchTimerText}>{timeStr} left</Text>
            </View>
          </View>
          <Text style={styles.mealMatchTitle}>{mealMatchPromo.title}</Text>
          <Text style={styles.mealMatchDesc}>{mealMatchPromo.description}</Text>
          <View style={styles.mealMatchProgressBar}>
            <View style={[styles.mealMatchProgressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <View style={styles.mealMatchStats}>
            <Text style={styles.mealMatchStat}>{mealMatchPromo.mealsMatched}/{mealMatchPromo.mealsGoal} meals donated</Text>
            <Text style={styles.mealMatchCta}>Drop a dish now →</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  const renderSponsorshipBanner = () => {
    if (!sponsorship || !sponsorship.isActive) return null;

    const progress = (sponsorship.currentDrops / sponsorship.dropsRequired) * 100;

    return (
      <Pressable style={styles.sponsorshipBanner}>
        <Image
          source={{ uri: sponsorship.bannerImageUrl }}
          style={styles.sponsorshipBg}
          resizeMode="cover"
        />
        <View style={styles.sponsorshipOverlay} />
        <View style={styles.sponsorshipContent}>
          <View style={styles.sponsorshipHeader}>
            <View style={styles.sponsorshipLiveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.sponsorshipTitle}>{sponsorship.title}</Text>
          </View>
          <Text style={styles.sponsorshipDesc} numberOfLines={2}>
            {sponsorship.description}
          </Text>
          <View style={styles.sponsorshipProgress}>
            <View style={styles.sponsorshipProgressBar}>
              <View style={[styles.sponsorshipProgressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.sponsorshipStats}>
              <Text style={styles.sponsorshipStat}>
                <Text style={styles.sponsorshipStatBold}>{sponsorship.currentDrops}</Text>/{sponsorship.dropsRequired} drops
              </Text>
              <Text style={styles.sponsorshipStat}>
                <Text style={styles.sponsorshipStatBold}>{sponsorship.currentMeals}</Text>/{sponsorship.totalMealsGoal} meals
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderMysteryBox = () => {
    if (!mysteryBox) return null;

    return (
      <Pressable
        style={styles.mysteryBoxCard}
        onPress={handleOpenMysteryBox}
      >
        <View style={styles.mysteryBoxIcon}>
          <Ionicons
            name={mysteryBoxOpened ? 'gift' : 'gift-outline'}
            size={28}
            color={mysteryBoxOpened ? Colors.warning : Colors.accent}
          />
        </View>
        <View style={styles.mysteryBoxInfo}>
          {mysteryBoxOpened ? (
            <>
              <Text style={styles.mysteryBoxTitle}>{mysteryBox.reward}</Text>
              <Text style={styles.mysteryBoxDesc} numberOfLines={1}>
                {mysteryBox.rewardDescription}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.mysteryBoxTitle}>Daily Mystery Box</Text>
              <Text style={styles.mysteryBoxDesc}>Tap to reveal today's deal!</Text>
            </>
          )}
        </View>
        {!mysteryBoxOpened && (
          <View style={styles.mysteryBoxTapBadge}>
            <Text style={styles.mysteryBoxTapText}>TAP</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderCoinBadge = () => (
    <View style={styles.coinBadge}>
      <Ionicons name="flash" size={14} color={Colors.warning} />
      <Text style={styles.coinText}>{coinBalance}</Text>
    </View>
  );

  const renderPost = ({ item: post }: { item: Post }) => (
    <SwipeablePost
      post={post}
      userLocation={userLocation}
      onLike={handleLike}
      onSave={handleSave}
      onShare={handleShare}
    />
  );

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading dishes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with feed toggle, filter button, and coin balance */}
      <View style={styles.feedToggle}>
        <Pressable
          style={[styles.feedFilterButton, activeFilterCount > 0 && styles.feedFilterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="options" size={18} color={activeFilterCount > 0 ? Colors.background : Colors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.feedFilterBadge}>
              <Text style={styles.feedFilterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.feedButton, feedType === 'friends' && styles.feedButtonActive]}
          onPress={() => setFeedType('friends')}
        >
          <Text style={[styles.feedButtonText, feedType === 'friends' && styles.feedButtonTextActive]}>
            Friends
          </Text>
        </Pressable>
        <Pressable
          style={[styles.feedButton, feedType === 'nearby' && styles.feedButtonActive]}
          onPress={() => setFeedType('nearby')}
        >
          <Text style={[styles.feedButtonText, feedType === 'nearby' && styles.feedButtonTextActive]}>
            Nearby
          </Text>
        </Pressable>
        {/* Coin badge removed per request */}
      </View>

      {/* Posts feed */}
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadPosts(true)}
            tintColor={Colors.accent}
          />
        }
        onEndReached={() => {
          if (nextCursor && !isLoading) {
            loadPosts();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View
            style={styles.feedHeader}
            onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          >
            {renderMealMatchBanner()}
            {renderSponsorshipBanner()}
            {renderMysteryBox()}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No dishes yet</Text>
            <Text style={styles.emptySubtext}>
              {feedType === 'friends'
                ? 'Follow people to see their posts here'
                : 'Be the first to share a dish nearby!'}
            </Text>
          </View>
        }
      />

      <FilterModal
        mode="feed"
        visible={showFilterModal}
        filters={feedFilters}
        onApply={setFeedFilters}
        onClose={() => setShowFilterModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  feedToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  feedButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  feedButtonActive: {
    backgroundColor: Colors.accent,
  },
  feedButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  feedButtonTextActive: {
    color: Colors.background,
  },
  coinBadge: {
    position: 'absolute',
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  coinText: {
    color: Colors.warning,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  feedFilterButton: {
    position: 'absolute',
    left: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedFilterButtonActive: {
    backgroundColor: Colors.accent,
  },
  feedFilterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedFilterBadgeText: {
    color: Colors.background,
    fontSize: 8,
    fontWeight: 'bold',
  },
  feedHeader: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  // Flash Sponsorship Banner
  sponsorshipBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    height: 160,
  },
  sponsorshipBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  sponsorshipOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sponsorshipContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  sponsorshipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sponsorshipLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text,
  },
  liveText: {
    color: Colors.text,
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  sponsorshipTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    flex: 1,
  },
  sponsorshipDesc: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  sponsorshipProgress: {
    gap: Spacing.xs,
  },
  sponsorshipProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sponsorshipProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  sponsorshipStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sponsorshipStat: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
  },
  sponsorshipStatBold: {
    color: Colors.accent,
    fontWeight: 'bold',
  },
  // Meal Match Flash Promo
  mealMatchBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  mealMatchGradient: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  mealMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealMatchLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  mealMatchLiveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mealMatchTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  mealMatchTimerText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  mealMatchTitle: {
    color: '#fff',
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  mealMatchDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSizes.sm,
    marginBottom: 8,
  },
  mealMatchProgressBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  mealMatchProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  mealMatchStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealMatchStat: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSizes.xs,
  },
  mealMatchCta: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  // Mystery Box
  mysteryBoxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(26, 202, 231, 0.2)',
  },
  mysteryBoxIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mysteryBoxInfo: {
    flex: 1,
  },
  mysteryBoxTitle: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  mysteryBoxDesc: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  mysteryBoxTapBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  mysteryBoxTapText: {
    color: Colors.background,
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  // Post styles
  swipeHint: {
    position: 'absolute',
    left: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  swipeHintText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  postContainer: {
    width: SCREEN_WIDTH,
    height: POST_HEIGHT,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.card,
  },
  overlayGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
  overlayGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  topBar: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 6,
  },
  username: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakText: {
    color: Colors.warning,
    fontSize: FontSizes.xs,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  topDateText: {
    color: Colors.text,
    fontSize: FontSizes.xs,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    marginTop: 2,
  },
  actionButtons: {
    position: 'absolute',
    right: Spacing.md,
    bottom: 150,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  actionButton: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  actionCount: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  dishInfo: {
    position: 'absolute',
    bottom: 60,
    left: Spacing.md,
    right: 70,
  },
  dishName: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postMealsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  postMealsBadgeText: {
    color: Colors.error,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  ratingColumn: {
    alignItems: 'center',
    gap: 3,
  },
  ratingScoreBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  ratingScoreText: {
    color: Colors.background,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  ddAvgBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ddAvgLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ddAvgValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restaurantName: {
    color: Colors.accent,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  restaurantCity: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  distanceText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  caption: {
    color: Colors.text,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    height: POST_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});

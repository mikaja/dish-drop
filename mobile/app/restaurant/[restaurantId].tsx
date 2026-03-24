import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor, PRICE_LEVELS } from '../../lib/constants';
import { api } from '../../lib/api';
import type { Restaurant, Post } from '../../types';
import MenuView from '../../components/MenuView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_SIZE = (SCREEN_WIDTH - Spacing.md * 2) / 2;

type SortOption = 'recent' | 'rating' | 'popular';
type ViewTab = 'posts' | 'menu';

export default function RestaurantScreen() {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewTab, setViewTab] = useState<ViewTab>('posts');
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadRestaurant = useCallback(async () => {
    try {
      const { restaurant: data } = await api.getRestaurant(restaurantId!);
      setRestaurant(data);
    } catch (error) {
      console.error('Error loading restaurant:', error);
    }
  }, [restaurantId]);

  const loadPosts = useCallback(async (refresh = false) => {
    try {
      const cursor = refresh ? undefined : nextCursor || undefined;
      const { posts: data, nextCursor: newCursor } = await api.getRestaurantPosts(
        restaurantId!,
        sortBy,
        cursor,
        20
      );

      if (refresh) {
        setPosts(data);
      } else {
        setPosts((prev) => [...prev, ...data]);
      }
      setNextCursor(newCursor);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }, [restaurantId, sortBy, nextCursor]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadRestaurant(), loadPosts(true)]);
      setIsLoading(false);
    }
    init();
  }, [loadRestaurant]);

  useEffect(() => {
    loadPosts(true);
  }, [sortBy]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadRestaurant(), loadPosts(true)]);
    setIsRefreshing(false);
  };

  const openMaps = () => {
    if (!restaurant) return;
    const url = `https://maps.google.com/?q=${encodeURIComponent(
      `${restaurant.name} ${restaurant.address} ${restaurant.city}`
    )}`;
    Linking.openURL(url);
  };

  const openReservation = () => {
    if (restaurant?.reservationUrl) {
      Linking.openURL(restaurant.reservationUrl);
    }
  };

  const openOrder = () => {
    if (restaurant?.orderUrl) {
      Linking.openURL(restaurant.orderUrl);
    }
  };

  const renderPostItem = ({ item: post, index }: { item: Post; index: number }) => (
    <Pressable
      style={styles.postItem}
      onPress={() => router.push({
        pathname: '/post/feed',
        params: {
          postIds: posts.map(p => p.id).join(','),
          startIndex: index.toString(),
          title: restaurant?.name || 'Restaurant',
        },
      })}
    >
      <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
      <View style={[styles.postRating, { backgroundColor: getRatingColor(post.rating) }]}>
        <Text style={styles.postRatingText}>{post.rating}</Text>
      </View>
    </Pressable>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Restaurant not found</Text>
      </View>
    );
  }

  const priceLabel = PRICE_LEVELS.find((p) => p.value === restaurant.priceLevel)?.label || '';

  return (
    <>
      <Stack.Screen
        options={{
          title: restaurant.name,
        }}
      />

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {restaurant.coverImage ? (
            <Image source={{ uri: restaurant.coverImage }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder]}>
              <Ionicons name="restaurant" size={48} color={Colors.textMuted} />
            </View>
          )}

          <View style={styles.logoContainer}>
            {restaurant.logoUrl ? (
              <Image source={{ uri: restaurant.logoUrl }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Ionicons name="restaurant" size={32} color={Colors.textMuted} />
              </View>
            )}
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{restaurant.name}</Text>

          <Pressable style={styles.addressRow} onPress={openMaps}>
            <Ionicons name="location" size={16} color={Colors.accent} />
            <Text style={styles.address}>
              {restaurant.address}, {restaurant.city}
            </Text>
          </Pressable>

          {restaurant.cuisineTypes.length > 0 && (
            <View style={styles.cuisineRow}>
              {restaurant.cuisineTypes.map((cuisine, i) => (
                <View key={cuisine} style={styles.cuisineTag}>
                  <Text style={styles.cuisineText}>{cuisine}</Text>
                </View>
              ))}
              {priceLabel && (
                <Text style={styles.priceLabel}>{priceLabel}</Text>
              )}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{restaurant.postCount}</Text>
            <Text style={styles.statLabel}>Dish Drops</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.ratingDisplay}>
              <Text style={styles.statValue}>
                {restaurant.averageRating ? restaurant.averageRating.toFixed(1) : 'New'}
              </Text>
            </View>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{restaurant.mealsDonated}</Text>
            <Text style={styles.statLabel}>Meals Donated</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {restaurant.website && (
            <Pressable style={[styles.actionButton, styles.websiteButton]} onPress={() => Linking.openURL(restaurant.website!)}>
              <Ionicons name="globe-outline" size={20} color={Colors.accent} />
              <Text style={[styles.actionButtonText, styles.websiteButtonText]}>Website</Text>
            </Pressable>
          )}
          {restaurant.reservationUrl && (
            <Pressable style={styles.actionButton} onPress={openReservation}>
              <Ionicons name="calendar" size={20} color={Colors.background} />
              <Text style={styles.actionButtonText}>Reserve</Text>
            </Pressable>
          )}
          {restaurant.orderUrl && (
            <Pressable style={[styles.actionButton, styles.orderButton]} onPress={openOrder}>
              <Ionicons name="bag-handle" size={20} color={Colors.text} />
              <Text style={[styles.actionButtonText, styles.orderButtonText]}>Order</Text>
            </Pressable>
          )}
        </View>

        {/* Posts / Menu Tab Bar */}
        <View style={styles.viewTabBar}>
          <Pressable
            style={[styles.viewTab, viewTab === 'posts' && styles.viewTabActive]}
            onPress={() => setViewTab('posts')}
          >
            <Ionicons
              name={viewTab === 'posts' ? 'grid' : 'grid-outline'}
              size={18}
              color={viewTab === 'posts' ? Colors.accent : Colors.textSecondary}
            />
            <Text style={[styles.viewTabText, viewTab === 'posts' && styles.viewTabTextActive]}>
              Posts
            </Text>
          </Pressable>
          <Pressable
            style={[styles.viewTab, viewTab === 'menu' && styles.viewTabActive]}
            onPress={() => setViewTab('menu')}
          >
            <Ionicons
              name={viewTab === 'menu' ? 'book' : 'book-outline'}
              size={18}
              color={viewTab === 'menu' ? Colors.accent : Colors.textSecondary}
            />
            <Text style={[styles.viewTabText, viewTab === 'menu' && styles.viewTabTextActive]}>
              Menu
            </Text>
          </Pressable>
        </View>

        {viewTab === 'posts' ? (
          <>
            {/* Sort Options */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              <View style={styles.sortOptions}>
                {(['recent', 'rating', 'popular'] as SortOption[]).map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.sortOption, sortBy === option && styles.sortOptionActive]}
                    onPress={() => setSortBy(option)}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        sortBy === option && styles.sortOptionTextActive,
                      ]}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Posts Grid */}
            <FlatList
              data={posts}
              renderItem={renderPostItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.postsGrid}
              onEndReached={() => {
                if (nextCursor) loadPosts();
              }}
              ListEmptyComponent={
                <View style={styles.emptyPosts}>
                  <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyPostsText}>No dishes posted yet</Text>
                  <Text style={styles.emptyPostsSubtext}>
                    Be the first to share a dish from here!
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          <MenuView restaurantId={restaurantId!} posts={posts} />
        )}
      </ScrollView>
    </>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
  },
  header: {
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.card,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    position: 'absolute',
    bottom: -40,
    left: Spacing.md,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    borderWidth: 3,
    borderColor: Colors.background,
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    padding: Spacing.md,
    paddingTop: 50,
  },
  name: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  address: {
    color: Colors.accent,
    fontSize: FontSizes.md,
  },
  cuisineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cuisineTag: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  cuisineText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  priceLabel: {
    color: Colors.success,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  websiteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  websiteButtonText: {
    color: Colors.accent,
  },
  orderButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderButtonText: {
    color: Colors.text,
  },
  viewTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  viewTabActive: {
    borderBottomColor: Colors.accent,
  },
  viewTabText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  viewTabTextActive: {
    color: Colors.accent,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  sortLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sortOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
  },
  sortOptionActive: {
    backgroundColor: Colors.accent,
  },
  sortOptionText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  sortOptionTextActive: {
    color: Colors.background,
  },
  postsGrid: {
    padding: Spacing.sm,
  },
  postItem: {
    width: POST_SIZE,
    height: POST_SIZE,
    margin: Spacing.xs,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.card,
  },
  postRating: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  postRatingText: {
    color: Colors.background,
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  emptyPosts: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyPostsText: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptyPostsSubtext: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },
});

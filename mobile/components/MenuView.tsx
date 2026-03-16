import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor } from '../lib/constants';
import { api } from '../lib/api';
import type { RestaurantMenu, MenuCategory, Post } from '../types';

interface MenuViewProps {
  restaurantId: string;
  posts: Post[];
}

export default function MenuView({ restaurantId, posts }: MenuViewProps) {
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMenu();
  }, [restaurantId]);

  const loadMenu = async () => {
    try {
      const { menu: data } = await api.getRestaurantMenu(restaurantId);
      setMenu(data);
      // Auto-expand all categories by default
      if (data.categories.length > 0) {
        setExpandedCategories(new Set(data.categories.map((c: MenuCategory) => c.name)));
      }
    } catch (error) {
      console.error('Error loading menu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const toggleItem = (itemKey: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  // Find matching reviews for a menu item (fuzzy match on dish name), limited to 9 most recent
  const getMatchingReviews = (itemName: string): Post[] => {
    const normalizedItem = itemName.toLowerCase().trim();
    const matched = posts.filter(post => {
      const normalizedDish = post.dishName.toLowerCase().trim();
      return normalizedDish === normalizedItem ||
        normalizedDish.includes(normalizedItem) ||
        normalizedItem.includes(normalizedDish);
    });
    // Sort by most recent and limit to 9
    return matched
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 9);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!menu || menu.categories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.emptyText}>Menu not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {menu.categories.map((category) => {
        const isExpanded = expandedCategories.has(category.name);
        return (
          <View key={category.name} style={styles.category}>
            <Pressable
              style={styles.categoryHeader}
              onPress={() => toggleCategory(category.name)}
            >
              <Text style={styles.categoryName}>{category.name}</Text>
              <View style={styles.categoryRight}>
                <Text style={styles.itemCount}>{category.items.length} items</Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </View>
            </Pressable>

            {isExpanded && (
              <View style={styles.itemsList}>
                {category.items.map((item) => {
                  const itemKey = `${category.name}-${item.name}`;
                  const isItemExpanded = expandedItems.has(itemKey);
                  const reviews = getMatchingReviews(item.name);
                  const hasReviews = reviews.length > 0;
                  const avgRating = hasReviews
                    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                    : null;

                  return (
                    <View key={itemKey}>
                      <Pressable
                        style={styles.menuItem}
                        onPress={() => hasReviews && toggleItem(itemKey)}
                      >
                        <View style={styles.menuItemInfo}>
                          <View style={styles.menuItemNameRow}>
                            <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
                            {hasReviews && (
                              <View style={styles.reviewBadge}>
                                <Ionicons name="camera" size={10} color={Colors.background} />
                                <Text style={styles.reviewBadgeText}>{reviews.length}</Text>
                              </View>
                            )}
                            {item.price && (
                              <Text style={styles.menuItemPrice}>{item.price}</Text>
                            )}
                          </View>
                          {item.description && (
                            <Text style={styles.menuItemDescription} numberOfLines={2}>
                              {item.description}
                            </Text>
                          )}
                        </View>
                        {avgRating !== null ? (
                          <View style={styles.avgRatingContainer}>
                            <View style={[styles.avgRatingSquare, { backgroundColor: getRatingColor(avgRating) }]}>
                              <Text style={styles.avgRatingSquareText}>{avgRating % 1 === 0 ? avgRating : avgRating.toFixed(1)}</Text>
                            </View>
                            <Text style={styles.avgRatingLabel}>DD Avg</Text>
                          </View>
                        ) : (
                          <View style={styles.avgRatingPlaceholder} />
                        )}
                      </Pressable>

                      {isItemExpanded && hasReviews && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.reviewsScroll}
                          contentContainerStyle={styles.reviewsContent}
                        >
                          {reviews.map((review) => (
                            <Pressable
                              key={review.id}
                              style={styles.reviewCard}
                              onPress={() => router.push(`/post/${review.id}`)}
                            >
                              <Image
                                source={{ uri: review.imageUrl }}
                                style={styles.reviewImage}
                              />
                              <View style={[styles.reviewRating, { backgroundColor: getRatingColor(review.rating) }]}>
                                <Text style={styles.reviewRatingText}>{review.rating}</Text>
                              </View>
                              <View style={styles.reviewInfo}>
                                <Text style={styles.reviewUser} numberOfLines={1}>
                                  @{review.user.username}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const REVIEW_CARD_SIZE = 120;

const styles = StyleSheet.create({
  container: {
    padding: Spacing.sm,
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
  },
  category: {
    marginBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  categoryName: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemCount: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  itemsList: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  menuItemInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  menuItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuItemName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  menuItemDescription: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  menuItemPrice: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginLeft: 'auto',
  },
  avgRatingContainer: {
    alignItems: 'center',
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  avgRatingSquare: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avgRatingSquareText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  avgRatingLabel: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  avgRatingPlaceholder: {
    width: 40,
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  reviewBadgeText: {
    color: Colors.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  reviewsScroll: {
    backgroundColor: Colors.background,
  },
  reviewsContent: {
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  reviewCard: {
    width: REVIEW_CARD_SIZE,
    position: 'relative',
  },
  reviewImage: {
    width: REVIEW_CARD_SIZE,
    height: REVIEW_CARD_SIZE,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.card,
  },
  reviewRating: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  reviewRatingText: {
    color: Colors.background,
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  reviewInfo: {
    marginTop: 4,
  },
  reviewUser: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
  },
});

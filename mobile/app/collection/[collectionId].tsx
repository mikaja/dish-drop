import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor } from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Collection, Post } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_SIZE = (SCREEN_WIDTH - Spacing.md * 3) / 2;

export default function CollectionScreen() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const { user: currentUser } = useAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const isOwner = collection?.userId === currentUser?.id;

  const loadCollection = useCallback(async (refresh = false) => {
    try {
      const cursor = refresh ? undefined : nextCursor || undefined;
      const { collection: data, items: postItems, nextCursor: newCursor } = await api.getCollection(
        collectionId!,
        cursor,
        20
      );

      setCollection(data);
      if (refresh) {
        setItems(postItems);
      } else {
        setItems((prev) => [...prev, ...postItems]);
      }
      setNextCursor(newCursor);
    } catch (error) {
      console.error('Error loading collection:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [collectionId, nextCursor]);

  useEffect(() => {
    loadCollection(true);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadCollection(true);
  };

  const handleRemoveItem = async (postId: string) => {
    if (!isOwner) return;

    try {
      await api.removeFromCollection(collectionId!, postId);
      setItems((prev) => prev.filter((item) => item.id !== postId));
      if (collection) {
        setCollection((prev) =>
          prev ? { ...prev, itemCount: prev.itemCount - 1 } : prev
        );
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const openPostFeed = (index: number) => {
    router.push({
      pathname: '/post/feed',
      params: {
        postIds: items.map(p => p.id).join(','),
        startIndex: index.toString(),
        title: collection?.name || 'Collection',
      },
    });
  };

  const renderItem = ({ item: post, index }: { item: Post; index: number }) => (
    <Pressable
      style={styles.itemCard}
      onPress={() => openPostFeed(index)}
    >
      <Image source={{ uri: post.imageUrl }} style={styles.itemImage} />
      <View style={[styles.itemRating, { backgroundColor: getRatingColor(post.rating) }]}>
        <Text style={styles.itemRatingText}>{post.rating}</Text>
      </View>

      {isOwner && (
        <Pressable
          style={styles.removeButton}
          onPress={() => handleRemoveItem(post.id)}
        >
          <Ionicons name="close-circle" size={24} color={Colors.error} />
        </Pressable>
      )}

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{post.dishName}</Text>
        <Text style={styles.itemRestaurant} numberOfLines={1}>
          {post.restaurant.name}
        </Text>
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

  if (!collection) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Collection not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: collection.name,
        }}
      />

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        onEndReached={() => {
          if (nextCursor && !isLoading) {
            loadCollection();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Cover Preview */}
            <View style={styles.coverContainer}>
              {collection.coverImage ? (
                <Image source={{ uri: collection.coverImage }} style={styles.coverImage} />
              ) : items.length > 0 ? (
                <View style={styles.coverGrid}>
                  {items.slice(0, 4).map((post, i) => (
                    <Image
                      key={post.id}
                      source={{ uri: post.imageUrl }}
                      style={styles.coverGridImage}
                    />
                  ))}
                </View>
              ) : (
                <View style={[styles.coverImage, styles.coverPlaceholder]}>
                  <Ionicons name="images-outline" size={48} color={Colors.textMuted} />
                </View>
              )}
            </View>

            {/* Collection Info */}
            <View style={styles.info}>
              <Text style={styles.name}>{collection.name}</Text>

              {collection.user && (
                <Pressable
                  style={styles.userRow}
                  onPress={() => router.push(`/profile/${collection.user!.id}`)}
                >
                  <Image
                    source={{ uri: collection.user.profileImage || 'https://via.placeholder.com/24' }}
                    style={styles.userAvatar}
                  />
                  <Text style={styles.userName}>@{collection.user.username}</Text>
                </Pressable>
              )}

              {collection.description && (
                <Text style={styles.description}>{collection.description}</Text>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.itemCount}>
                  {collection.itemCount} {collection.itemCount === 1 ? 'dish' : 'dishes'}
                </Text>
                <View style={styles.privacyBadge}>
                  <Ionicons
                    name={collection.isPublic ? 'globe-outline' : 'lock-closed-outline'}
                    size={14}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.privacyText}>
                    {collection.isPublic ? 'Public' : 'Private'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No dishes in this collection</Text>
            {isOwner && (
              <Text style={styles.emptySubtext}>
                Save dishes to add them to this collection
              </Text>
            )}
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  listContent: {
    backgroundColor: Colors.background,
  },
  header: {
    marginBottom: Spacing.md,
  },
  coverContainer: {
    width: '100%',
    aspectRatio: 2,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.card,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  coverGridImage: {
    width: '50%',
    height: '50%',
    backgroundColor: Colors.card,
  },
  info: {
    padding: Spacing.md,
  },
  name: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  userName: {
    color: Colors.accent,
    fontSize: FontSizes.md,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  itemCount: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  itemCard: {
    width: POST_SIZE,
    margin: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: POST_SIZE,
    backgroundColor: Colors.surface,
  },
  itemRating: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  itemRatingText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
  },
  itemInfo: {
    padding: Spacing.sm,
  },
  itemName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  itemRestaurant: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor } from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Post } from '../../types';
import { format } from 'date-fns';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const POST_HEIGHT = SCREEN_HEIGHT - 120;

export default function PostFeedScreen() {
  const { postIds: postIdsParam, startIndex: startIndexParam, title } = useLocalSearchParams<{
    postIds: string;
    startIndex: string;
    title: string;
  }>();

  const postIds = postIdsParam ? postIdsParam.split(',') : [];
  const startIndex = parseInt(startIndexParam || '0', 10);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      // Load all posts in parallel
      const results = await Promise.all(
        postIds.map(async (id) => {
          try {
            const { post } = await api.getPost(id);
            return post;
          } catch {
            return null;
          }
        })
      );
      setPosts(results.filter((p): p is Post => p !== null));
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            ? { ...p, isLiked: !isLiked, likeCount: p.likeCount + (isLiked ? -1 : 1) }
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
            ? { ...p, isSaved: !isSaved, saveCount: p.saveCount + (isSaved ? -1 : 1) }
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
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const renderPost = ({ item: post }: { item: Post }) => (
    <View style={styles.postContainer}>
      {/* Post image */}
      <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.25, 0.55, 1]}
        style={styles.postOverlay}
      />

      {/* Top info */}
      <View style={styles.topInfo}>
        <Pressable
          style={styles.userRow}
          onPress={() => router.push(`/profile/${post.user.id}`)}
        >
          {post.user.avatarUrl ? (
            <Image source={{ uri: post.user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={14} color={Colors.textMuted} />
            </View>
          )}
          <Text style={styles.username}>{post.user.displayName || post.user.username}</Text>
        </Pressable>
        <Text style={styles.dateText}>{format(new Date(post.createdAt), 'MMM d, yyyy')}</Text>
      </View>

      {/* Rating */}
      <View style={styles.ratingColumn}>
        <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(post.rating) }]}>
          <Text style={styles.ratingText}>{post.rating}</Text>
        </View>
        {post.restaurant.averageRating != null && (
          <View style={styles.ddAvgBadge}>
            <Text style={styles.ddAvgLabel}>DD</Text>
            <Text style={styles.ddAvgValue}>{post.restaurant.averageRating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <Text style={styles.dishName} numberOfLines={1}>{post.dishName}</Text>
        <Pressable onPress={() => router.push(`/restaurant/${post.restaurant.id}`)}>
          <View style={styles.restaurantRow}>
            <Ionicons name="location" size={14} color={Colors.accent} />
            <Text style={styles.restaurantName} numberOfLines={1}>{post.restaurant.name}</Text>
          </View>
        </Pressable>
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={2}>{post.caption}</Text>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <Pressable style={styles.actionButton} onPress={() => handleLike(post.id, post.isLiked || false)}>
          <Ionicons
            name={post.isLiked ? 'heart' : 'heart-outline'}
            size={28}
            color={post.isLiked ? Colors.error : '#fff'}
          />
          <Text style={styles.actionCount}>{post.likeCount}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push(`/post/${post.id}`)}>
          <Ionicons name="chatbubble-outline" size={26} color="#fff" />
          <Text style={styles.actionCount}>{post.commentCount}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => handleSave(post.id, post.isSaved || false)}>
          <Ionicons
            name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={26}
            color={post.isSaved ? Colors.accent : '#fff'}
          />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => handleShare(post)}>
          <Ionicons name="share-outline" size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      {title && (
        <View style={styles.titleContainer}>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        </View>
      )}

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        snapToInterval={POST_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        initialScrollIndex={startIndex > 0 && startIndex < posts.length ? startIndex : 0}
        getItemLayout={(_, index) => ({
          length: POST_HEIGHT,
          offset: POST_HEIGHT * index,
          index,
        })}
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 64,
    right: 16,
    zIndex: 10,
  },
  titleText: {
    color: '#fff',
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  postContainer: {
    width: SCREEN_WIDTH,
    height: POST_HEIGHT,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topInfo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 96 : 56,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSizes.xs,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ratingColumn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 100,
    right: Spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  ratingBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  ratingText: {
    color: Colors.background,
    fontSize: FontSizes.xl,
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
  },
  ddAvgValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 80,
    left: Spacing.md,
    right: 60,
  },
  dishName: {
    color: '#fff',
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  restaurantName: {
    color: '#fff',
    fontSize: FontSizes.md,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FontSizes.sm,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 80,
    right: Spacing.md,
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionCount: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

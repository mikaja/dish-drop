import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor } from '../lib/constants';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { User, Post, Collection } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = Spacing.xs;
const NUM_COLUMNS = 2;
const POST_SIZE = Math.floor((SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);

type Tab = 'posts' | 'likes' | 'collections';

interface ProfileViewProps {
  userId: string;
  isTabView?: boolean;
}

export default function ProfileView({ userId, isTabView }: ProfileViewProps) {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  const [posts, setPosts] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Post[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const isOwnProfile = currentUser?.id === userId;

  const loadProfile = useCallback(async () => {
    try {
      const { user: userData } = await api.getUser(userId);
      setProfile(userData);
      setIsFollowing(userData.isFollowing || false);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [userId]);

  const loadPosts = useCallback(async () => {
    try {
      const { posts: data } = await api.getUserPosts(userId);
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }, [userId]);

  const loadLikes = useCallback(async () => {
    try {
      const { likes: data } = await api.getUserLikes(userId);
      setLikes(data);
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  }, [userId]);

  const loadCollections = useCallback(async () => {
    try {
      const { collections: data } = await api.getPublicCollections(userId);
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }, [userId]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadProfile(), loadPosts()]);
      setIsLoading(false);
    }
    init();
  }, [loadProfile, loadPosts]);

  useEffect(() => {
    if (activeTab === 'likes' && likes.length === 0) {
      loadLikes();
    } else if (activeTab === 'collections' && collections.length === 0) {
      loadCollections();
    }
  }, [activeTab, likes.length, collections.length, loadLikes, loadCollections]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadProfile(), loadPosts()]);
    setIsRefreshing(false);
  };

  const handleFollow = async () => {
    if (!currentUser) {
      router.push('/(auth)/login');
      return;
    }

    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        if (profile?._count?.followers !== undefined) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  _count: {
                    ...prev._count!,
                    followers: prev._count!.followers - 1,
                  },
                }
              : prev
          );
        }
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        if (profile?._count?.followers !== undefined) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  _count: {
                    ...prev._count!,
                    followers: prev._count!.followers + 1,
                  },
                }
              : prev
          );
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <>
      {!isTabView && (
        <Stack.Screen
          options={{
            title: profile.username,
          }}
        />
      )}

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
        {/* Profile Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + Spacing.md, 60) }]}>
          <Image
            source={{ uri: profile.profileImage || 'https://via.placeholder.com/100' }}
            style={styles.avatar}
          />

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>

            {profile.team && (
              <View style={styles.teamBadge}>
                <Ionicons name="people" size={14} color={Colors.accent} />
                <Text style={styles.teamName}>{profile.team.name}</Text>
              </View>
            )}

            {profile.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.mealsDonated}</Text>
            <Text style={styles.statLabel}>Meals</Text>
          </View>
          <Pressable
            style={styles.statItem}
            onPress={() => router.push(`/profile/${userId}/followers`)}
          >
            <Text style={styles.statValue}>{profile._count?.followers || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <Pressable
            style={styles.statItem}
            onPress={() => router.push(`/profile/${userId}/following`)}
          >
            <Text style={styles.statValue}>{profile._count?.following || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.postCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
            >
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing && styles.followingButtonText,
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          </View>
        )}

        {isOwnProfile && (
          <View style={styles.actionButtons}>
            <Pressable
              style={styles.editButton}
              onPress={() => router.push('/profile/edit')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={activeTab === 'posts' ? Colors.accent : Colors.textSecondary}
            />
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'likes' && styles.activeTab]}
            onPress={() => setActiveTab('likes')}
          >
            <Ionicons
              name="heart-outline"
              size={20}
              color={activeTab === 'likes' ? Colors.accent : Colors.textSecondary}
            />
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'collections' && styles.activeTab]}
            onPress={() => setActiveTab('collections')}
          >
            <Ionicons
              name="bookmark-outline"
              size={20}
              color={activeTab === 'collections' ? Colors.accent : Colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === 'posts' && (
          posts.length > 0 ? (
            <View style={styles.postsGrid}>
              {posts.map((post, index) => (
                <Pressable
                  key={post.id}
                  style={styles.postItem}
                  onPress={() => router.push({
                    pathname: '/post/feed',
                    params: { postIds: posts.map(p => p.id).join(','), startIndex: index.toString(), title: 'Posts' },
                  })}
                >
                  <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
                  <View style={[styles.postRating, { backgroundColor: getRatingColor(post.rating) }]}>
                    <Text style={styles.postRatingText}>{post.rating}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabText}>No posts yet</Text>
            </View>
          )
        )}

        {activeTab === 'likes' && (
          likes.length > 0 ? (
            <View style={styles.postsGrid}>
              {likes.map((post, index) => (
                <Pressable
                  key={post.id}
                  style={styles.postItem}
                  onPress={() => router.push({
                    pathname: '/post/feed',
                    params: { postIds: likes.map(p => p.id).join(','), startIndex: index.toString(), title: 'Liked Posts' },
                  })}
                >
                  <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
                  <View style={[styles.postRating, { backgroundColor: getRatingColor(post.rating) }]}>
                    <Text style={styles.postRatingText}>{post.rating}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabText}>No liked posts</Text>
            </View>
          )
        )}

        {activeTab === 'collections' && (
          collections.length > 0 ? (
            <View style={styles.collectionsGrid}>
              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  style={styles.collectionItem}
                  onPress={() => router.push(`/collection/${collection.id}`)}
                >
                  <View style={styles.collectionPreview}>
                    {collection.previewImages?.slice(0, 4).map((url, i) => (
                      <Image key={i} source={{ uri: url }} style={styles.collectionPreviewImage} />
                    ))}
                  </View>
                  <Text style={styles.collectionName}>{collection.name}</Text>
                  <Text style={styles.collectionCount}>{collection.itemCount} dishes</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabText}>No public collections</Text>
            </View>
          )
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
    flexDirection: 'row',
    padding: Spacing.lg,
    paddingTop: 60,
    gap: Spacing.lg,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.card,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  username: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  teamName: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
  },
  bio: {
    color: Colors.text,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
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
  actionButtons: {
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  followButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  followingButtonText: {
    color: Colors.text,
  },
  editButton: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: Spacing.xs,
    gap: GRID_GAP,
  },
  postItem: {
    width: POST_SIZE,
    height: POST_SIZE,
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
  collectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: Spacing.xs,
    gap: GRID_GAP,
  },
  collectionItem: {
    width: POST_SIZE,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  collectionPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 100,
  },
  collectionPreviewImage: {
    width: '50%',
    height: 50,
  },
  collectionName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  collectionCount: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  emptyTab: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyTabText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
});

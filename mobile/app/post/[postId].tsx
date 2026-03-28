import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor } from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Post, Comment } from '../../types';
import { formatDistanceToNow, format } from 'date-fns';
import { Paths, File as ExpoFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ReportModal from '../../components/ReportModal';

export default function PostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user: currentUser } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment' | 'user'; id: string } | null>(null);

  const loadPost = useCallback(async () => {
    try {
      const { post: data } = await api.getPost(postId!);
      setPost(data);
    } catch (error) {
      console.error('Error loading post:', error);
    }
  }, [postId]);

  const loadComments = useCallback(async () => {
    try {
      const { comments: data } = await api.getComments(postId!);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }, [postId]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadPost(), loadComments()]);
      setIsLoading(false);
    }
    init();
  }, [loadPost, loadComments]);

  const handleLike = async () => {
    if (!post) return;

    try {
      if (post.isLiked) {
        await api.unlikePost(postId!);
        setPost((prev) =>
          prev ? { ...prev, isLiked: false, likeCount: prev.likeCount - 1 } : prev
        );
      } else {
        await api.likePost(postId!);
        setPost((prev) =>
          prev ? { ...prev, isLiked: true, likeCount: prev.likeCount + 1 } : prev
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async () => {
    if (!post) return;

    try {
      if (post.isSaved) {
        await api.unsavePost(postId!);
        setPost((prev) =>
          prev ? { ...prev, isSaved: false, saveCount: prev.saveCount - 1 } : prev
        );
      } else {
        await api.savePost(postId!);
        setPost((prev) =>
          prev ? { ...prev, isSaved: true, saveCount: prev.saveCount + 1 } : prev
        );
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const { comment } = await api.addComment(postId!, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      if (post) {
        setPost((prev) =>
          prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev
        );
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostOptions = () => {
    if (!post || !currentUser) return;
    const isOwnPost = post.userId === currentUser.id;

    const buttons: any[] = [];
    if (!isOwnPost) {
      buttons.push({
        text: 'Report Post',
        onPress: () => setReportTarget({ type: 'post', id: postId! }),
      });
      buttons.push({
        text: 'Block User',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            `Block @${post.user.username}?`,
            "They won't be able to see your posts or interact with you. You won't see their content in your feed.",
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.blockUser(post.userId);
                    Alert.alert('User Blocked', `@${post.user.username} has been blocked.`);
                    router.back();
                  } catch {
                    Alert.alert('Error', 'Failed to block user.');
                  }
                },
              },
            ]
          );
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(undefined as any, undefined as any, buttons);
  };

  const handleCommentReport = (commentId: string) => {
    Alert.alert('Comment Options', undefined, [
      {
        text: 'Report Comment',
        onPress: () => setReportTarget({ type: 'comment', id: commentId }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      const message = `Check out this ${post.dishName} from ${post.restaurant.name} on DishDrop! Rated ${post.rating}/10`;

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

      await Share.share({
        message,
        title: `${post.dishName} - DishDrop`,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share post');
    }
  };

  const renderComment = ({ item: comment }: { item: Comment }) => (
    <Pressable
      style={styles.commentItem}
      onLongPress={() => {
        if (currentUser && comment.userId !== currentUser.id) {
          handleCommentReport(comment.id);
        }
      }}
    >
      <Pressable onPress={() => router.push(`/profile/${comment.user.id}`)}>
        <Image
          source={{ uri: comment.user.profileImage || 'https://via.placeholder.com/40' }}
          style={styles.commentAvatar}
        />
      </Pressable>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>@{comment.user.username}</Text>
          <Text style={styles.commentTime}>
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.content}</Text>
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

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: post.dishName,
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.scrollView}>
          {/* Post Image */}
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} />

          {/* Post Info */}
          <View style={styles.postInfo}>
            {/* User Info */}
            <View style={styles.userSection}>
              <Pressable
                style={styles.userRow}
                onPress={() => router.push(`/profile/${post.user.id}`)}
              >
                <Image
                  source={{ uri: post.user.profileImage || 'https://via.placeholder.com/40' }}
                  style={styles.userAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{post.user.name}</Text>
                  <Text style={styles.userUsername}>@{post.user.username}</Text>
                </View>
                {post.user.mealStreak && post.user.mealStreak > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={14} color={Colors.warning} />
                    <Text style={styles.streakText}>{post.user.mealStreak}</Text>
                  </View>
                )}
              </Pressable>

              {post.donationMade && (
                <View style={styles.donationBadgeTop}>
                  <Ionicons name="heart" size={14} color={Colors.error} />
                  <Text style={styles.donationTextTop}>
                    {post.mealsDonated} meal{post.mealsDonated !== 1 ? 's' : ''} donated with this post
                  </Text>
                </View>
              )}
            </View>

            {/* Dish Info */}
            <View style={styles.dishInfo}>
              <View style={styles.dishHeader}>
                <Text style={styles.dishName} numberOfLines={2}>{post.dishName}</Text>
                <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(post.rating) }]}>
                  <Text style={styles.ratingText}>{post.rating}/10</Text>
                </View>
              </View>

              <Pressable
                style={styles.restaurantRow}
                onPress={() => router.push(`/restaurant/${post.restaurant.id}`)}
              >
                <Ionicons name="location" size={16} color={Colors.accent} />
                <Text style={styles.restaurantName} numberOfLines={1}>{post.restaurant.name}</Text>
              </Pressable>

              {post.caption && (
                <Text style={styles.caption}>{post.caption}</Text>
              )}

              {post.dietaryTags.length > 0 && (
                <View style={styles.tagsRow}>
                  {post.dietaryTags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable style={styles.actionButton} onPress={handleLike}>
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={post.isLiked ? Colors.error : Colors.text}
                />
                <Text style={styles.actionCount}>{post.likeCount}</Text>
              </Pressable>

              <View style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={22} color={Colors.text} />
                <Text style={styles.actionCount}>{post.commentCount}</Text>
              </View>

              <Pressable style={styles.actionButton} onPress={handleSave}>
                <Ionicons
                  name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={post.isSaved ? Colors.accent : Colors.text}
                />
                <Text style={styles.actionCount}>{post.saveCount}</Text>
              </Pressable>

              <Pressable style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color={Colors.text} />
              </Pressable>

              {currentUser && post.userId !== currentUser.id && (
                <Pressable style={styles.actionButton} onPress={handlePostOptions}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} />
                </Pressable>
              )}
            </View>

            {/* Time */}
            <Text style={styles.timestamp}>
              {format(new Date(post.createdAt), 'MMM d, yyyy \u2022 h:mm a')}
            </Text>
          </View>

          {/* Comments */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>
              Comments ({comments.length})
            </Text>

            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.noComments}>No comments yet. Be the first!</Text>
              }
            />
          </View>
        </ScrollView>

        {/* Comment Input */}
        {currentUser && (
          <View style={styles.commentInputContainer}>
            <Image
              source={{ uri: currentUser.profileImage || 'https://via.placeholder.com/36' }}
              style={styles.inputAvatar}
            />
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textMuted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={1000}
            />
            <Pressable
              style={[styles.sendButton, (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={newComment.trim() ? Colors.accent : Colors.textMuted}
                />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {reportTarget && (
        <ReportModal
          visible={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
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
  postImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.card,
  },
  postInfo: {
    padding: Spacing.md,
  },
  userSection: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  donationBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  donationTextTop: {
    color: Colors.error,
    fontSize: FontSizes.sm,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
  },
  userName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  userUsername: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginLeft: 'auto',
    gap: 2,
  },
  streakText: {
    color: Colors.warning,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  dishInfo: {
    gap: Spacing.sm,
  },
  dishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dishName: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    flex: 1,
  },
  ratingBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  ratingText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restaurantName: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    flex: 1,
  },
  caption: {
    color: Colors.text,
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  donationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  donationText: {
    color: Colors.error,
    fontSize: FontSizes.sm,
  },
  actionRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  actionCount: {
    color: Colors.text,
    fontSize: FontSizes.sm,
  },
  timestamp: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  commentsSection: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentsTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commentUsername: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  commentTime: {
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
  },
  commentText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    marginTop: 2,
  },
  noComments: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  inputAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: FontSizes.md,
    maxHeight: 100,
  },
  sendButton: {
    padding: Spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

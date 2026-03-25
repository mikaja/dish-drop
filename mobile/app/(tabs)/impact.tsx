import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import FlashSponsorships from '../../components/FlashSponsorships';
import RewardsSection from '../../components/RewardsSection';
import type { GlobalStats, PersonalStats, Team, Achievement, LeaderboardEntry } from '../../types';

export default function ImpactScreen() {
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<LeaderboardEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { stats: global } = await api.getGlobalStats();
      setGlobalStats(global);

      if (isAuthenticated) {
        const [personalRes, leaderboardRes] = await Promise.all([
          api.getPersonalStats(),
          api.getFriendsLeaderboard(5),
        ]);

        setPersonalStats(personalRes.stats ?? null);
        setCurrentTeam(personalRes.team ?? null);
        setAchievements(personalRes.achievements ?? []);
        setFriendsLeaderboard(leaderboardRes.leaderboard ?? []);
      }
    } catch (error) {
      console.error('Error loading impact data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const progress = globalStats
    ? Math.min((globalStats.totalMeals / globalStats.currentGoal) * 100, 100)
    : 0;

  return (
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
      {/* 1. Community Impact Section - Redesigned */}
      <View style={styles.globalSection}>
        <View style={styles.communityImpactCard}>
          <View style={styles.communityImpactHeader}>
            <Ionicons name="heart" size={16} color={Colors.accent} />
            <Text style={styles.communityImpactLabel}>COMMUNITY IMPACT</Text>
          </View>
          <Text style={styles.communityImpactValue}>
            {(globalStats?.totalMeals || 0).toLocaleString()}
          </Text>
          <Text style={styles.communityImpactSubtitle}>meals donated</Text>
          <View style={styles.communityGoalRow}>
            <Text style={styles.communityGoalLabel}>Next Goal</Text>
            <Text style={styles.communityGoalTarget}>
              {(globalStats?.currentGoal || 0).toLocaleString()} meals
            </Text>
          </View>
          <View style={styles.communityProgressBar}>
            <View style={[styles.communityProgressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.communityProgressText}>
            {Math.round(progress)}% to unlock community rewards
          </Text>
        </View>
      </View>

      {/* 2. Flash Sponsorships */}
      <FlashSponsorships limit={3} />

      {isAuthenticated ? (
        <>
          {/* 3. Personal Impact Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Impact</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="heart" size={24} color={Colors.error} />
                <Text style={styles.statValue}>{personalStats?.mealsDonated || 0}</Text>
                <Text style={styles.statLabel}>Meals Donated</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="flame" size={24} color={Colors.warning} />
                <Text style={styles.statValue}>{personalStats?.mealStreak || 0}</Text>
                <Text style={styles.statLabel}>Week Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="camera" size={24} color={Colors.accent} />
                <Text style={styles.statValue}>{personalStats?.postCount || 0}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="logo-bitcoin" size={24} color={Colors.warning} />
                <Text style={styles.statValue}>{user?.coins || 0}</Text>
                <Text style={styles.statLabel}>Coins</Text>
              </View>
            </View>
          </View>

          {/* 4. Consolidated Rewards / Coupons (coins-driven) */}
          <RewardsSection limit={6} />

          {/* Team */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Team</Text>
            {currentTeam ? (
              <Pressable
                style={styles.teamCard}
                onPress={() => router.push(`/teams/${currentTeam.id}` as any)}
              >
                {currentTeam.logoUrl && (
                  <Image source={{ uri: currentTeam.logoUrl }} style={styles.teamLogo} />
                )}
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{currentTeam.name}</Text>
                  <Text style={styles.teamStats}>
                    {currentTeam.memberCount} members • {currentTeam.totalMeals.toLocaleString()} meals
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </Pressable>
            ) : (
              <Pressable style={styles.joinTeamCard}>
                <Ionicons name="people" size={32} color={Colors.accent} />
                <Text style={styles.joinTeamText}>Join a team to compete with others!</Text>
                <Pressable style={styles.joinTeamButton}>
                  <Text style={styles.joinTeamButtonText}>Find Teams</Text>
                </Pressable>
              </Pressable>
            )}
          </View>

          {/* Friends Leaderboard */}
          {friendsLeaderboard.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Friends Leaderboard</Text>
              <View style={styles.leaderboardCard}>
                {friendsLeaderboard.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={[
                      styles.leaderboardEntry,
                      entry.isCurrentUser && styles.leaderboardEntryCurrent,
                    ]}
                    onPress={() => router.push(`/profile/${entry.id}`)}
                  >
                    <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
                    <Image
                      source={{ uri: entry.profileImage || 'https://via.placeholder.com/40' }}
                      style={styles.leaderboardAvatar}
                    />
                    <View style={styles.leaderboardInfo}>
                      <Text style={styles.leaderboardName}>{entry.name}</Text>
                      <Text style={styles.leaderboardUsername}>@{entry.username}</Text>
                    </View>
                    <Text style={styles.leaderboardMeals}>{entry.mealsDonated}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.signInPrompt}>
          <Ionicons name="heart-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.signInTitle}>Sign in to track your impact</Text>
          <Text style={styles.signInText}>
            See your donation stats, join teams, and unlock achievements
          </Text>
          <Pressable
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
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
  globalSection: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  communityImpactCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 202, 231, 0.2)',
  },
  communityImpactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  communityImpactLabel: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  communityImpactValue: {
    color: Colors.text,
    fontSize: 48,
    fontWeight: 'bold',
  },
  communityImpactSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginBottom: Spacing.md,
  },
  communityGoalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.sm,
  },
  communityGoalLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  communityGoalTarget: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  communityProgressBar: {
    width: '100%',
    height: 10,
    backgroundColor: Colors.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  communityProgressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 5,
  },
  communityProgressText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  section: {
    padding: Spacing.md,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    marginVertical: Spacing.xs,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  teamCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.surface,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  teamStats: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  joinTeamCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  joinTeamText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  joinTeamButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  joinTeamButtonText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  leaderboardCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leaderboardEntryCurrent: {
    backgroundColor: Colors.surface,
  },
  leaderboardRank: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    width: 30,
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  leaderboardUsername: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  leaderboardMeals: {
    color: Colors.accent,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  // Challenges
  signInPrompt: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  signInTitle: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: '600',
  },
  signInText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  signInButtonText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});

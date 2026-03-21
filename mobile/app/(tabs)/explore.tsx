import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/core';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSizes, BorderRadius, getRatingColor, calculateDistance } from '../../lib/constants';
import { api } from '../../lib/api';
import { useLocation } from '../../contexts/LocationContext';
import FilterModal, { countExploreFilters } from '../../components/FilterModal';
import CollectionsView from '../../components/CollectionsView';
import type { Post, Restaurant, TrendingDish, SponsoredPost, ExploreFilterState } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const BOTTOM_SHEET_MIN_HEIGHT = 120;

export default function ExploreScreen() {
  const isFocused = useIsFocused();
  const { coords, isLocating, permissionDenied, refreshLocation } = useLocation();
  const mapRef = useRef<MapView>(null);
  const bottomSheetAnim = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
  const hasInitializedRef = useRef(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [restaurantPosts, setRestaurantPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [region, setRegion] = useState<Region | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.02);
  const [trendingDishes, setTrendingDishes] = useState<TrendingDish[]>([]);
  const [exploreMode, setExploreMode] = useState<'explore' | 'collections'>('explore');
  const [sponsoredPost, setSponsoredPost] = useState<SponsoredPost | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<ExploreFilterState>({
    cuisines: [],
    priceLevels: [],
    minRating: 0,
    maxDistance: null,
    hasReservations: false,
    hasDelivery: false,
    sort: 'rating',
  });
  const activeFilterCount = countExploreFilters(filters);

  // When location coordinates become available, center map and load restaurants
  useEffect(() => {
    if (coords) {
      const newRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(newRegion);
      setCurrentRegion(newRegion);
      // Animate map if already rendered
      mapRef.current?.animateToRegion(newRegion, 500);
      // Only load restaurants once
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        loadRestaurants(coords.latitude, coords.longitude);
      }
    }
  }, [coords]);

  useEffect(() => {
    const loadExtras = async () => {
      try {
        const [trendingRes, sponsoredRes] = await Promise.all([
          api.getTrendingDishes(6),
          api.getSponsoredPost(),
        ]);
        setTrendingDishes(trendingRes.dishes);
        setSponsoredPost(sponsoredRes.sponsored);
      } catch (error) {
        console.error('Error loading explore extras:', error);
      }
    };
    loadExtras();
  }, []);

  const loadRestaurants = async (lat: number, lng: number) => {
    try {
      setIsLoading(true);
      const { restaurants: nearbyRestaurants } = await api.getNearbyRestaurants(lat, lng, 45);
      setRestaurants(nearbyRestaurants);
    } catch (error) {
      console.error('Error loading restaurants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRestaurantPosts = async (restaurantId: string) => {
    try {
      setIsLoadingPosts(true);
      const { posts } = await api.getRestaurantPosts(restaurantId, 'recent', undefined, 10);
      setRestaurantPosts(posts);
    } catch (error) {
      console.error('Error loading restaurant posts:', error);
      setRestaurantPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handleMarkerPress = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    loadRestaurantPosts(restaurant.id);
    expandBottomSheet();

    mapRef.current?.animateToRegion({
      latitude: restaurant.latitude - 0.005,
      longitude: restaurant.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 300);
  }, []);

  const expandBottomSheet = () => {
    setIsBottomSheetExpanded(true);
    Animated.spring(bottomSheetAnim, {
      toValue: BOTTOM_SHEET_MAX_HEIGHT,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const collapseBottomSheet = () => {
    setIsBottomSheetExpanded(false);
    setSelectedRestaurant(null);
    setRestaurantPosts([]);
    Animated.spring(bottomSheetAnim, {
      toValue: BOTTOM_SHEET_MIN_HEIGHT,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const bottomSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0 && isBottomSheetExpanded) {
          const newHeight = BOTTOM_SHEET_MAX_HEIGHT - gestureState.dy;
          if (newHeight >= BOTTOM_SHEET_MIN_HEIGHT) {
            bottomSheetAnim.setValue(newHeight);
          }
        } else if (gestureState.dy < 0 && !isBottomSheetExpanded) {
          const newHeight = BOTTOM_SHEET_MIN_HEIGHT - gestureState.dy;
          if (newHeight <= BOTTOM_SHEET_MAX_HEIGHT) {
            bottomSheetAnim.setValue(newHeight);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          collapseBottomSheet();
        } else if (gestureState.dy < -50) {
          expandBottomSheet();
        } else {
          // Snap back to current state
          if (isBottomSheetExpanded) {
            expandBottomSheet();
          } else {
            Animated.spring(bottomSheetAnim, {
              toValue: BOTTOM_SHEET_MIN_HEIGHT,
              useNativeDriver: false,
              friction: 8,
            }).start();
          }
        }
      },
    })
  ).current;

  const handleMapPress = () => {
    if (isBottomSheetExpanded) {
      collapseBottomSheet();
    }
  };

  const centerOnUser = async () => {
    if (!coords) {
      await refreshLocation();
      return;
    }

    mapRef.current?.animateToRegion({
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: zoomLevel,
      longitudeDelta: zoomLevel,
    }, 300);
    setShowSearchArea(false);
  };

  const handleRegionChange = (newRegion: Region) => {
    setCurrentRegion(newRegion);
    if (region) {
      const latDiff = Math.abs(newRegion.latitude - region.latitude);
      const lngDiff = Math.abs(newRegion.longitude - region.longitude);
      if (latDiff > 0.005 || lngDiff > 0.005) {
        setShowSearchArea(true);
      }
    }
  };

  const searchThisArea = () => {
    if (!currentRegion) return;
    setShowSearchArea(false);
    setRegion(currentRegion);
    loadRestaurants(currentRegion.latitude, currentRegion.longitude);
  };

  const zoomIn = () => {
    if (!currentRegion) return;
    const newZoom = Math.max(0.005, zoomLevel / 2);
    setZoomLevel(newZoom);
    mapRef.current?.animateToRegion({
      ...currentRegion,
      latitudeDelta: newZoom,
      longitudeDelta: newZoom,
    }, 200);
  };

  const zoomOut = () => {
    if (!currentRegion) return;
    const newZoom = Math.min(0.5, zoomLevel * 2);
    setZoomLevel(newZoom);
    mapRef.current?.animateToRegion({
      ...currentRegion,
      latitudeDelta: newZoom,
      longitudeDelta: newZoom,
    }, 200);
  };

  const getPriceLevel = (level?: number) => {
    if (!level) return '$';
    return '$'.repeat(level);
  };

  const userLat = coords?.latitude ?? 0;
  const userLng = coords?.longitude ?? 0;

  const filteredRestaurants = useMemo(() => {
    let result = restaurants.filter((r) => {
      // Search query
      if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Cuisine filter
      if (filters.cuisines.length > 0 && !r.cuisineTypes?.some((c) => filters.cuisines.includes(c))) {
        return false;
      }
      // Price level filter
      if (filters.priceLevels.length > 0 && (!r.priceLevel || !filters.priceLevels.includes(r.priceLevel))) {
        return false;
      }
      // Min rating
      if (filters.minRating > 0 && (r.averageRating || 0) < filters.minRating) {
        return false;
      }
      // Max distance
      if (filters.maxDistance !== null) {
        const dist = calculateDistance(userLat, userLng, r.latitude, r.longitude);
        if (dist > filters.maxDistance) return false;
      }
      // Reservations
      if (filters.hasReservations && !r.reservationUrl) return false;
      // Delivery
      if (filters.hasDelivery && !r.orderUrl) return false;
      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (filters.sort) {
        case 'rating':
          return (b.averageRating || 0) - (a.averageRating || 0);
        case 'distance': {
          const distA = calculateDistance(userLat, userLng, a.latitude, a.longitude);
          const distB = calculateDistance(userLat, userLng, b.latitude, b.longitude);
          return distA - distB;
        }
        case 'popular':
          return (b.postCount || 0) - (a.postCount || 0);
        case 'newest':
        default:
          return 0; // keep original order
      }
    });

    return result;
  }, [restaurants, searchQuery, filters, userLat, userLng]);

  const renderRestaurantMarker = (restaurant: Restaurant) => {
    const isSelected = selectedRestaurant?.id === restaurant.id;

    return (
      <Marker
        key={restaurant.id}
        coordinate={{
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
        }}
        onPress={() => handleMarkerPress(restaurant)}
      >
        <View style={[styles.markerContainer, isSelected && styles.markerSelected]}>
          <View style={[styles.markerBubble, isSelected && styles.markerBubbleSelected]}>
            <Text style={[styles.markerRating, isSelected && styles.markerRatingSelected]}>
              {restaurant.averageRating != null ? Number(restaurant.averageRating).toFixed(1) : 'New'}
            </Text>
          </View>
          <View style={[styles.markerArrow, isSelected && styles.markerArrowSelected]} />
        </View>
      </Marker>
    );
  };

  const renderFriendReview = (post: Post) => (
    <Pressable
      key={post.id}
      style={styles.reviewCard}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      <Image source={{ uri: post.imageUrl }} style={styles.reviewImage} />
      <View style={styles.reviewContent}>
        <View style={styles.reviewHeader}>
          <Image
            source={{ uri: post.user.profileImage || 'https://via.placeholder.com/32' }}
            style={styles.reviewAvatar}
          />
          <View style={styles.reviewUserInfo}>
            <Text style={styles.reviewUsername}>@{post.user.username}</Text>
            <Text style={styles.reviewDish}>{post.dishName}</Text>
          </View>
          <View style={[styles.reviewRating, { backgroundColor: getRatingColor(post.rating) }]}>
            <Text style={styles.reviewRatingText}>{post.rating}</Text>
          </View>
        </View>
        {post.caption && (
          <Text style={styles.reviewCaption} numberOfLines={2}>
            {post.caption}
          </Text>
        )}
      </View>
    </Pressable>
  );

  const renderTrendingDishes = () => {
    if (trendingDishes.length === 0) return null;

    return (
      <View style={styles.trendingSection}>
        <View style={styles.trendingHeader}>
          <Ionicons name="trending-up" size={18} color={Colors.accent} />
          <Text style={styles.trendingSectionTitle}>Trending Near You</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {trendingDishes.map((dish) => (
            <Pressable
              key={dish.id}
              style={styles.trendingCard}
              onPress={() => router.push(`/restaurant/${dish.restaurantId}`)}
            >
              <Image source={{ uri: dish.imageUrl }} style={styles.trendingImage} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.trendingOverlay}
              />
              <View style={styles.trendingInfo}>
                <Text style={styles.trendingDishName} numberOfLines={1}>{dish.dishName}</Text>
                <Text style={styles.trendingRestaurant} numberOfLines={1}>{dish.restaurantName}</Text>
                <View style={styles.trendingMeta}>
                  <View style={[styles.trendingRating, { backgroundColor: getRatingColor(dish.averageRating) }]}>
                    <Text style={styles.trendingRatingText}>{dish.averageRating}</Text>
                  </View>
                  <Text style={styles.trendingPosts}>{dish.postCount} drops</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSponsoredCard = () => {
    if (!sponsoredPost) return null;

    return (
      <Pressable
        style={styles.sponsoredCard}
        onPress={() => {
          if (sponsoredPost.ctaUrl) Linking.openURL(sponsoredPost.ctaUrl);
        }}
      >
        <Image source={{ uri: sponsoredPost.imageUrl }} style={styles.sponsoredImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.sponsoredOverlay}
        />
        <View style={styles.sponsoredContent}>
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredBadgeText}>Sponsored</Text>
          </View>
          <Text style={styles.sponsoredTitle}>{sponsoredPost.title}</Text>
          <Text style={styles.sponsoredSubtitle} numberOfLines={2}>{sponsoredPost.subtitle}</Text>
          <View style={styles.sponsoredCta}>
            <Text style={styles.sponsoredCtaText}>{sponsoredPost.ctaText}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.background} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderListItem = (restaurant: Restaurant) => (
    <Pressable
      key={restaurant.id}
      style={styles.listItem}
      onPress={() => {
        setSelectedRestaurant(restaurant);
        loadRestaurantPosts(restaurant.id);
        setViewMode('map');
        handleMarkerPress(restaurant);
      }}
    >
      <View style={styles.listItemLeft}>
        <View style={[styles.listItemRating, { backgroundColor: getRatingColor(restaurant.averageRating || 0) }]}>
          <Text style={styles.listItemRatingText}>{restaurant.averageRating != null ? Number(restaurant.averageRating).toFixed(1) : 'New'}</Text>
        </View>
      </View>
      <View style={styles.listItemContent}>
        <Text style={styles.listItemName} numberOfLines={1}>{restaurant.name}</Text>
        <Text style={styles.listItemDetails}>
          {restaurant.cuisineTypes?.slice(0, 2).join(' • ')} • {getPriceLevel(restaurant.priceLevel)}
        </Text>
        <Text style={styles.listItemCity}>{restaurant.city}</Text>
      </View>
      <View style={styles.listItemRight}>
        <Text style={styles.listItemPosts}>{restaurant.postCount} posts</Text>
        {restaurant.reservationUrl && (
          <View style={styles.listItemReserveBadge}>
            <Ionicons name="calendar-outline" size={10} color={Colors.accent} />
            <Text style={styles.listItemReserveText}>Reserve</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </View>
    </Pressable>
  );

  if (isLocating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Locating...</Text>
      </View>
    );
  }

  if (!coords && permissionDenied) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="location-outline" size={48} color={Colors.textMuted} />
        <Text style={[styles.loadingText, { marginTop: Spacing.md, fontSize: FontSizes.lg }]}>
          Location access needed
        </Text>
        <Text style={[styles.loadingText, { marginTop: Spacing.sm }]}>
          Enable location to discover restaurants near you.
        </Text>
        <Pressable
          style={{
            marginTop: Spacing.lg,
            backgroundColor: Colors.accent,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            borderRadius: BorderRadius.lg,
          }}
          onPress={refreshLocation}
        >
          <Text style={{ color: Colors.background, fontWeight: '600', fontSize: FontSizes.md }}>
            Enable Location
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading && restaurants.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Finding restaurants near you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mode Toggle: Explore | Collections */}
      <View style={styles.modeToggleBar}>
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, exploreMode === 'explore' && styles.modeButtonActive]}
            onPress={() => setExploreMode('explore')}
          >
            <Text style={[styles.modeButtonText, exploreMode === 'explore' && styles.modeButtonTextActive]}>
              Explore
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, exploreMode === 'collections' && styles.modeButtonActive]}
            onPress={() => setExploreMode('collections')}
          >
            <Text style={[styles.modeButtonText, exploreMode === 'collections' && styles.modeButtonTextActive]}>
              Collections
            </Text>
          </Pressable>
        </View>
      </View>

      {exploreMode === 'collections' ? (
        <CollectionsView paddingTop={0} />
      ) : (
      <View style={{ flex: 1 }}>
      {/* Search Bar */}
      <View style={styles.searchOverlay}>
        <Pressable
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="options" size={20} color={activeFilterCount > 0 ? Colors.background : Colors.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={styles.viewToggle}>
          <Pressable
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={18} color={viewMode === 'map' ? Colors.background : Colors.text} />
          </Pressable>
          <Pressable
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? Colors.background : Colors.text} />
          </Pressable>
        </View>
      </View>

      {viewMode === 'map' ? (
        <>
          {isFocused && region ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={region}
            onPress={handleMapPress}
            onRegionChangeComplete={handleRegionChange}
            showsUserLocation
            showsMyLocationButton={false}
            customMapStyle={darkMapStyle}
            zoomEnabled={true}
            zoomControlEnabled={false}
            rotateEnabled={true}
            scrollEnabled={true}
            pitchEnabled={true}
          >
            {filteredRestaurants.map(renderRestaurantMarker)}
          </MapView>
          ) : (
            <View style={styles.map} />
          )}

          {showSearchArea && (
            <Pressable style={styles.searchAreaButton} onPress={searchThisArea}>
              <Ionicons name="refresh" size={16} color={Colors.background} />
              <Text style={styles.searchAreaText}>Search this area</Text>
            </Pressable>
          )}

          <View style={styles.zoomControls}>
            <Pressable style={styles.zoomButton} onPress={zoomIn}>
              <Ionicons name="add" size={24} color={Colors.text} />
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable style={styles.zoomButton} onPress={zoomOut}>
              <Ionicons name="remove" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <Pressable style={styles.centerButton} onPress={centerOnUser}>
            <Ionicons name="locate" size={24} color={Colors.text} />
          </Pressable>

          {/* Bottom Sheet */}
          <Animated.View style={[styles.bottomSheet, { height: bottomSheetAnim }]}>
            <View
              style={styles.bottomSheetHandle}
              {...bottomSheetPanResponder.panHandlers}
            >
              <View style={styles.handleBar} />
            </View>

            {selectedRestaurant ? (
              <ScrollView
                style={styles.bottomSheetContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Restaurant Header */}
                <View style={styles.restaurantHeader}>
                  <View style={styles.restaurantInfo}>
                    <Text style={styles.restaurantName} numberOfLines={1}>{selectedRestaurant.name}</Text>
                    <View style={styles.restaurantMeta}>
                      <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(selectedRestaurant.averageRating || 0) }]}>
                        <Text style={styles.ratingText}>{selectedRestaurant.averageRating != null ? Number(selectedRestaurant.averageRating).toFixed(1) : 'New'}</Text>
                      </View>
                      <Text style={styles.cuisineText}>
                        {selectedRestaurant.cuisineTypes?.slice(0, 2).join(' • ')}
                      </Text>
                      <Text style={styles.priceText}>{getPriceLevel(selectedRestaurant.priceLevel)}</Text>
                    </View>
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.addressText}>
                        {selectedRestaurant.address}, {selectedRestaurant.city}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.viewAllButton}
                    onPress={() => router.push(`/restaurant/${selectedRestaurant.id}`)}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
                  </Pressable>
                </View>

                {/* Action Buttons (Reserve / Order) */}
                {(selectedRestaurant.reservationUrl || selectedRestaurant.orderUrl) && (
                  <View style={styles.restaurantActions}>
                    {selectedRestaurant.reservationUrl && (
                      <Pressable
                        style={styles.reserveButton}
                        onPress={() => Linking.openURL(selectedRestaurant.reservationUrl!)}
                      >
                        <Ionicons name="calendar-outline" size={16} color={Colors.background} />
                        <Text style={styles.reserveButtonText}>Reserve Table</Text>
                      </Pressable>
                    )}
                    {selectedRestaurant.orderUrl && (
                      <Pressable
                        style={styles.orderButton}
                        onPress={() => Linking.openURL(selectedRestaurant.orderUrl!)}
                      >
                        <Ionicons name="bag-outline" size={16} color={Colors.accent} />
                        <Text style={styles.orderButtonText}>Order Now</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedRestaurant.postCount}</Text>
                    <Text style={styles.statLabel}>Posts</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedRestaurant.mealsDonated}</Text>
                    <Text style={styles.statLabel}>Meals Donated</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="heart" size={16} color={Colors.error} />
                    <Text style={styles.statLabel}>Community Fave</Text>
                  </View>
                </View>

                {/* Friend Reviews Section */}
                <View style={styles.reviewsSection}>
                  <Text style={styles.sectionTitle}>Friends' Reviews</Text>
                  {isLoadingPosts ? (
                    <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.md }} />
                  ) : restaurantPosts.length > 0 ? (
                    restaurantPosts.map(renderFriendReview)
                  ) : (
                    <View style={styles.emptyReviews}>
                      <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
                      <Text style={styles.emptyText}>No reviews yet</Text>
                      <Text style={styles.emptySubtext}>Be the first to share a dish!</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.bottomSheetPlaceholder}>
                <Ionicons name="restaurant-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.placeholderText}>Tap a restaurant to see details</Text>
                <Text style={styles.placeholderSubtext}>{filteredRestaurants.length} restaurants nearby</Text>
              </View>
            )}
          </Animated.View>
        </>
      ) : (
        /* List View */
        <ScrollView style={styles.listContainer}>
          {/* Trending Dishes */}
          {renderTrendingDishes()}

          {/* Sponsored Card */}
          {renderSponsoredCard()}

          <Text style={styles.listTitle}>
            Restaurants Near You{activeFilterCount > 0 ? ` (${filteredRestaurants.length})` : ''}
          </Text>
          {filteredRestaurants.map(renderListItem)}
        </ScrollView>
      )}

      <FilterModal
        mode="explore"
        visible={showFilterModal}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFilterModal(false)}
      />
      </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modeToggleBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    zIndex: 20,
    elevation: 20,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.full,
    padding: 3,
  },
  modeButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modeButtonActive: {
    backgroundColor: Colors.accent,
  },
  modeButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: Colors.background,
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
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    padding: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.md,
    gap: Spacing.sm,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.accent,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: Colors.background,
    fontSize: 9,
    fontWeight: 'bold',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.md,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  toggleButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  toggleButtonActive: {
    backgroundColor: Colors.accent,
  },
  map: {
    flex: 1,
  },
  centerButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: BOTTOM_SHEET_MIN_HEIGHT + Spacing.md,
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  searchAreaButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  searchAreaText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  zoomControls: {
    position: 'absolute',
    right: Spacing.md,
    bottom: BOTTOM_SHEET_MIN_HEIGHT + 70,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  zoomButton: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerSelected: {
    transform: [{ scale: 1.2 }],
  },
  markerBubble: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  markerBubbleSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  markerRating: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  markerRatingSelected: {
    color: Colors.background,
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.accent,
    marginTop: -1,
  },
  markerArrowSelected: {
    borderTopColor: Colors.accent,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  bottomSheetPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
  },
  placeholderSubtext: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  restaurantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  ratingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  ratingText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  cuisineText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  priceText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  // Reserve / Order buttons
  restaurantActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reserveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  reserveButtonText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  orderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  orderButtonText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  reviewsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  reviewImage: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.surface,
  },
  reviewContent: {
    padding: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUsername: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  reviewDish: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  reviewRating: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  reviewRatingText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  reviewCaption: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.sm,
  },
  emptyReviews: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
  // Trending Dishes
  trendingSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  trendingSectionTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  trendingCard: {
    width: 150,
    height: 180,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  trendingImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  trendingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  trendingInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  trendingDishName: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trendingRestaurant: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  trendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  trendingRating: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  trendingRatingText: {
    color: Colors.background,
    fontSize: FontSizes.xs,
    fontWeight: 'bold',
  },
  trendingPosts: {
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
  },
  // Sponsored Card
  sponsoredCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    height: 140,
  },
  sponsoredImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  sponsoredOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sponsoredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  sponsoredBadgeText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
  },
  sponsoredTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sponsoredSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sponsoredCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  sponsoredCtaText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  // List View
  listContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 120 : 80,
  },
  listTitle: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  listItemLeft: {
    alignItems: 'center',
  },
  listItemRating: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemRatingText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
  listItemContent: {
    flex: 1,
  },
  listItemName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  listItemDetails: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  listItemCity: {
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  listItemPosts: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
  },
  listItemReserveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(26, 202, 231, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  listItemReserveText: {
    color: Colors.accent,
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
});

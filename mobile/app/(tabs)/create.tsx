import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, FontSizes, BorderRadius, DIETARY_TAGS, CUISINE_TYPES, getRatingColor } from '../../lib/constants';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import type { Restaurant, MenuItem, MenuCategory } from '../../types';

type Step = 'photo' | 'restaurant' | 'details' | 'tags';

export default function CreateScreen() {
  const { user } = useAuth();
  const { coords } = useLocation();
  const [currentStep, setCurrentStep] = useState<Step>('photo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Form data
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [dishName, setDishName] = useState('');
  const [rating, setRating] = useState(7);
  const [caption, setCaption] = useState('');
  const [price, setPrice] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cuisineType, setCuisineType] = useState('');
  const [donateMeals, setDonateMeals] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [globalMealCount, setGlobalMealCount] = useState<number | null>(null);

  // Menu autocomplete
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);

  // Restaurant search
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false);

  useEffect(() => {
    // Load global meal count for the donate section
    api.getGlobalStats().then(({ stats }) => {
      setGlobalMealCount(stats.totalMeals);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentStep === 'restaurant') {
      loadNearbyRestaurants();
    }
  }, [currentStep]);

  const loadNearbyRestaurants = async () => {
    if (!coords) return;
    setIsLoadingRestaurants(true);
    try {
      const { restaurants } = await api.getNearbyRestaurants(
        coords.latitude,
        coords.longitude,
        20
      );
      setNearbyRestaurants(restaurants);
    } catch (error) {
      console.error('Error loading restaurants:', error);
    } finally {
      setIsLoadingRestaurants(false);
    }
  };

  // Fetch menu when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      loadMenu();
    }
  }, [selectedRestaurant]);

  const loadMenu = async () => {
    if (!selectedRestaurant) return;
    setIsLoadingMenu(true);
    try {
      const { menu } = await api.getRestaurantMenu(selectedRestaurant.id);
      const allItems: MenuItem[] = menu.categories.flatMap(
        (cat: MenuCategory) => cat.items
      );
      setMenuItems(allItems);
    } catch (error) {
      console.error('Error loading menu:', error);
      setMenuItems([]);
    } finally {
      setIsLoadingMenu(false);
    }
  };

  const handleDishNameChange = (text: string) => {
    setDishName(text);
    if (text.trim().length === 0) {
      setFilteredMenuItems([]);
      setShowSuggestions(false);
      return;
    }
    const query = text.toLowerCase().trim();
    const filtered = menuItems.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
    setFilteredMenuItems(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
  };

  const selectMenuItem = (item: MenuItem) => {
    setDishName(item.name);
    setShowSuggestions(false);
    if (item.price) {
      const numericPrice = item.price.replace(/[^0-9.]/g, '');
      if (numericPrice && !price) {
        setPrice(numericPrice);
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to select images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setCurrentStep('restaurant');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setCurrentStep('restaurant');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!imageUri || !selectedRestaurant || !dishName.trim()) {
      Alert.alert('Missing info', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // In production, upload image to S3/storage first
      // For now, using placeholder
      const imageUrl = imageUri.startsWith('http') ? imageUri : 'https://via.placeholder.com/500';

      await api.createPost({
        dishName: dishName.trim(),
        imageUrl,
        rating,
        restaurantId: selectedRestaurant.id,
        caption: caption.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        dietaryTags: selectedTags.length > 0 ? selectedTags : undefined,
        cuisineType: cuisineType || undefined,
        isPrivate,
        donateMeals,
      });

      Alert.alert('Posted!', 'Your dish has been shared', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRestaurants = nearbyRestaurants.filter((r) =>
    r.name.toLowerCase().includes(restaurantSearch.toLowerCase())
  );

  // Step 1: Photo selection
  if (currentStep === 'photo') {
    return (
      <View style={styles.container}>
        <View style={styles.photoContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="restaurant-outline" size={80} color={Colors.textMuted} />
              <Text style={styles.placeholderText}>Add a photo of your dish</Text>
            </View>
          )}
        </View>

        <View style={styles.photoButtons}>
          <Pressable style={styles.photoButton} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color={Colors.text} />
            <Text style={styles.photoButtonText}>Take Photo</Text>
          </Pressable>
          <Pressable style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="images" size={24} color={Colors.text} />
            <Text style={styles.photoButtonText}>Choose from Library</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Step 2: Restaurant selection
  if (currentStep === 'restaurant') {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setCurrentStep('photo')}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.stepTitle}>Where did you eat?</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants..."
            placeholderTextColor={Colors.textMuted}
            value={restaurantSearch}
            onChangeText={setRestaurantSearch}
          />
        </View>

        {isLoadingRestaurants ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
        ) : (
          <ScrollView style={styles.restaurantList}>
            {filteredRestaurants.map((restaurant) => (
              <Pressable
                key={restaurant.id}
                style={[
                  styles.restaurantItem,
                  selectedRestaurant?.id === restaurant.id && styles.restaurantItemSelected,
                ]}
                onPress={() => {
                  setSelectedRestaurant(restaurant);
                  setCurrentStep('details');
                }}
              >
                <Ionicons name="location" size={20} color={Colors.accent} />
                <View style={styles.restaurantInfo}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.restaurantAddress}>{restaurant.address}</Text>
                </View>
                {selectedRestaurant?.id === restaurant.id && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // Step 3: Dish details
  if (currentStep === 'details') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 200 }}
        >
          <View style={styles.stepHeader}>
            <Pressable onPress={() => setCurrentStep('restaurant')}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.stepTitle}>Dish Details</Text>
            <Pressable onPress={() => setCurrentStep('tags')}>
              <Text style={styles.nextButton}>Next</Text>
            </Pressable>
          </View>

          <View style={styles.detailsContent}>
            <Image source={{ uri: imageUri! }} style={styles.thumbnailPreview} />

            {/* Dish Name with Autocomplete */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dish Name *</Text>
              <TextInput
                style={styles.input}
                placeholder={
                  menuItems.length > 0
                    ? 'Search the menu or type a dish...'
                    : 'What did you order?'
                }
                placeholderTextColor={Colors.textMuted}
                value={dishName}
                onChangeText={handleDishNameChange}
                onFocus={() => {
                  if (dishName.trim().length > 0 && filteredMenuItems.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              {isLoadingMenu && (
                <ActivityIndicator
                  size="small"
                  color={Colors.accent}
                  style={{ position: 'absolute', right: Spacing.md, top: 40 }}
                />
              )}
              {showSuggestions && filteredMenuItems.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {filteredMenuItems.map((item, index) => (
                    <Pressable
                      key={`${item.name}-${index}`}
                      style={styles.suggestionItem}
                      onPress={() => selectMenuItem(item)}
                    >
                      <View style={styles.suggestionContent}>
                        <Text style={styles.suggestionName}>{item.name}</Text>
                        {item.price && (
                          <Text style={styles.suggestionPrice}>{item.price}</Text>
                        )}
                      </View>
                      {item.description && (
                        <Text style={styles.suggestionDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Rating Slider */}
            <View style={styles.inputGroup}>
              <View style={styles.sliderLabelRow}>
                <Text style={styles.label}>Rating</Text>
                <View style={[styles.ratingValueBadge, { backgroundColor: getRatingColor(rating) }]}>
                  <Text style={styles.ratingValueText}>{rating}/10</Text>
                </View>
              </View>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderEndLabel}>1</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={rating}
                  onValueChange={(value: number) => setRating(value)}
                  minimumTrackTintColor={getRatingColor(rating)}
                  maximumTrackTintColor={Colors.border}
                  thumbTintColor={getRatingColor(rating)}
                />
                <Text style={styles.sliderEndLabel}>10</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Caption (optional)</Text>
                <Pressable style={styles.doneButton} onPress={() => Keyboard.dismiss()}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about this dish..."
                placeholderTextColor={Colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price (optional)</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceCurrencySymbol}>$</Text>
                <TextInput
                  style={[styles.input, styles.priceInput]}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  value={price}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                  onChangeText={(text) => {
                    // Strip all non-digit characters
                    const digits = text.replace(/[^0-9]/g, '');
                    if (digits === '' || digits === '0' || digits === '00' || digits === '000') {
                      setPrice('');
                      return;
                    }
                    // Convert to cents then format as dollars
                    const cents = parseInt(digits, 10);
                    const formatted = (cents / 100).toFixed(2);
                    setPrice(formatted);
                  }}
                  keyboardType="number-pad"
                />
              </View>
              {price !== '' && (
                <Text style={styles.pricePreview}>${price}</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 4: Tags and submit
  return (
    <ScrollView style={styles.container}>
      <View style={styles.stepHeader}>
        <Pressable onPress={() => setCurrentStep('details')}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.stepTitle}>Tags & Options</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.detailsContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cuisine Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tagsRow}>
              {CUISINE_TYPES.slice(0, 15).map((cuisine) => (
                <Pressable
                  key={cuisine}
                  style={[styles.tag, cuisineType === cuisine && styles.tagSelected]}
                  onPress={() => setCuisineType(cuisineType === cuisine ? '' : cuisine)}
                >
                  <Text style={[styles.tagText, cuisineType === cuisine && styles.tagTextSelected]}>
                    {cuisine}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dietary Tags</Text>
          <View style={styles.tagsWrap}>
            {DIETARY_TAGS.map((tag) => (
              <Pressable
                key={tag}
                style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>
                  {tag}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {user && user.mealsBalance > 0 && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Donate Meals</Text>
            <View style={styles.mealDonateContainer}>
              {globalMealCount != null && (
                <View style={styles.globalMealsRow}>
                  <Ionicons name="heart" size={14} color={Colors.accent} />
                  <Text style={styles.globalMealsCount}>
                    {globalMealCount.toLocaleString()} meals donated globally
                  </Text>
                </View>
              )}
              <View style={styles.mealDonateRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.mealButton,
                    pressed && styles.mealButtonPressed,
                    donateMeals <= 0 && styles.mealButtonDisabled,
                  ]}
                  onPress={() => setDonateMeals(Math.max(0, donateMeals - 1))}
                  disabled={donateMeals <= 0}
                >
                  <Text style={[
                    styles.mealButtonText,
                    donateMeals <= 0 && styles.mealButtonTextDisabled,
                  ]}>−</Text>
                </Pressable>

                <View style={styles.earthContainer}>
                  <Text style={styles.earthEmoji}>🌍</Text>
                  <Text style={styles.mealCount}>{donateMeals}</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.mealButton,
                    pressed && styles.mealButtonPressed,
                    donateMeals >= Math.min(user.mealsBalance, 5) && styles.mealButtonDisabled,
                  ]}
                  onPress={() => setDonateMeals(Math.min(Math.min(user.mealsBalance, 5), donateMeals + 1))}
                  disabled={donateMeals >= Math.min(user.mealsBalance, 5)}
                >
                  <Text style={[
                    styles.mealButtonText,
                    donateMeals >= Math.min(user.mealsBalance, 5) && styles.mealButtonTextDisabled,
                  ]}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.mealBalanceText}>
                {user.mealsBalance} meals available
              </Text>
            </View>
          </View>
        )}

        <Pressable
          style={styles.toggleRow}
          onPress={() => setIsPrivate(!isPrivate)}
        >
          <Text style={styles.toggleLabel}>Post to friends only</Text>
          <Ionicons
            name={isPrivate ? 'checkbox' : 'square-outline'}
            size={24}
            color={isPrivate ? Colors.accent : Colors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.submitButtonText}>Post Dish</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  placeholder: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  placeholderText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
  },
  previewImage: {
    width: 300,
    height: 300,
    borderRadius: BorderRadius.lg,
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  photoButton: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  photoButtonText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  nextButton: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    margin: Spacing.md,
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
  restaurantList: {
    flex: 1,
  },
  restaurantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  restaurantItemSelected: {
    backgroundColor: Colors.card,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  restaurantAddress: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  detailsContent: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  thumbnailPreview: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    alignSelf: 'center',
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  doneButtonText: {
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCurrencySymbol: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginRight: Spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  pricePreview: {
    color: Colors.accent,
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  suggestionsContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
    maxHeight: 280,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  suggestionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '500',
    flex: 1,
  },
  suggestionPrice: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  suggestionDescription: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderEndLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '500',
    width: 20,
    textAlign: 'center',
  },
  mealDonateContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  globalMealsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  globalMealsCount: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  mealDonateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  mealButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.cardHover,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealButtonPressed: {
    backgroundColor: Colors.accent,
    transform: [{ scale: 0.95 }],
  },
  mealButtonDisabled: {
    borderColor: Colors.textMuted,
    opacity: 0.4,
  },
  mealButtonText: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  mealButtonTextDisabled: {
    color: Colors.textMuted,
  },
  earthContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  earthEmoji: {
    fontSize: 80,
  },
  mealCount: {
    color: Colors.text,
    fontSize: 42,
    fontWeight: '800',
    marginTop: Spacing.xs,
  },
  mealBalanceText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.md,
  },
  ratingValueBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  ratingValueText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  donateValueText: {
    color: Colors.error,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tagText: {
    color: Colors.text,
    fontSize: FontSizes.sm,
  },
  tagTextSelected: {
    color: Colors.background,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  toggleLabel: {
    color: Colors.text,
    fontSize: FontSizes.md,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: Colors.background,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
});

import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Colors, Spacing, FontSizes } from '../lib/constants';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lastUpdated}>Last Updated: March 28, 2026</Text>

      <Text style={styles.body}>
        Welcome to DishDrop. By creating an account or using our app, you agree to these Terms of Service ("Terms"). Please read them carefully.
      </Text>

      <Text style={styles.heading}>1. Acceptance of Terms</Text>
      <Text style={styles.body}>
        By accessing or using DishDrop, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not use the app.
      </Text>

      <Text style={styles.heading}>2. Account Registration</Text>
      <Text style={styles.body}>
        You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 13 years old to use DishDrop.
      </Text>

      <Text style={styles.heading}>3. User-Generated Content</Text>
      <Text style={styles.body}>
        You retain ownership of content you post on DishDrop. By posting content, you grant DishDrop a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the app.
      </Text>
      <Text style={styles.body}>
        You are solely responsible for the content you post and must ensure it does not violate these Terms or applicable laws.
      </Text>

      <Text style={styles.heading}>4. Zero Tolerance for Objectionable Content</Text>
      <Text style={styles.body}>
        DishDrop has a strict zero-tolerance policy for objectionable content and abusive behavior. The following content is strictly prohibited:
      </Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Hate speech, discrimination, or content targeting individuals or groups based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin</Text>
        <Text style={styles.listItem}>• Harassment, bullying, threats, or intimidation of any kind</Text>
        <Text style={styles.listItem}>• Sexually explicit or pornographic material</Text>
        <Text style={styles.listItem}>• Graphic violence or content promoting self-harm</Text>
        <Text style={styles.listItem}>• Spam, misleading content, or fraudulent activity</Text>
        <Text style={styles.listItem}>• Content that infringes on intellectual property rights</Text>
        <Text style={styles.listItem}>• Personal information of others shared without consent</Text>
        <Text style={styles.listItem}>• Content promoting illegal activities</Text>
      </View>

      <Text style={styles.heading}>5. Content Moderation and Reporting</Text>
      <Text style={styles.body}>
        DishDrop actively monitors and moderates content. Users can report objectionable content or abusive users using the reporting features in the app. All reports are reviewed within 24 hours.
      </Text>
      <Text style={styles.body}>
        DishDrop reserves the right to remove any content that violates these Terms without notice. Users who violate these Terms may have their accounts suspended or permanently terminated.
      </Text>

      <Text style={styles.heading}>6. User Blocking</Text>
      <Text style={styles.body}>
        You may block other users at any time. Blocked users will not be able to see your content or interact with you. Blocking a user also sends a notification to our moderation team for review.
      </Text>

      <Text style={styles.heading}>7. Account Termination</Text>
      <Text style={styles.body}>
        DishDrop may suspend or terminate your account at any time if you violate these Terms, engage in abusive behavior, or post objectionable content. Users who provide offending content will be ejected from the platform.
      </Text>
      <Text style={styles.body}>
        You may delete your account at any time through the Settings menu. Account deletion is permanent and cannot be reversed.
      </Text>

      <Text style={styles.heading}>8. Meal Donations</Text>
      <Text style={styles.body}>
        DishDrop facilitates meal donations through partnerships with charitable organizations. Donation amounts and delivery are managed by our partner organizations. DishDrop does not guarantee specific delivery timelines or recipients.
      </Text>

      <Text style={styles.heading}>9. Intellectual Property</Text>
      <Text style={styles.body}>
        The DishDrop name, logo, and app design are the property of DishDrop. You may not use our trademarks without written permission.
      </Text>

      <Text style={styles.heading}>10. Disclaimer of Warranties</Text>
      <Text style={styles.body}>
        DishDrop is provided "as is" without warranties of any kind. We do not guarantee the accuracy of restaurant information, user reviews, or ratings. Always verify information independently.
      </Text>

      <Text style={styles.heading}>11. Limitation of Liability</Text>
      <Text style={styles.body}>
        DishDrop shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app.
      </Text>

      <Text style={styles.heading}>12. Changes to Terms</Text>
      <Text style={styles.body}>
        We may update these Terms from time to time. Continued use of DishDrop after changes constitutes acceptance of the updated Terms. We will notify users of material changes.
      </Text>

      <Text style={styles.heading}>13. Contact</Text>
      <Text style={styles.body}>
        If you have questions about these Terms, contact us at support@dishdrop.app.
      </Text>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  lastUpdated: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.lg,
  },
  heading: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  list: {
    marginLeft: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  listItem: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  spacer: {
    height: Spacing.xxl,
  },
});

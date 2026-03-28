import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { Colors, Spacing, FontSizes } from '../lib/constants';

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.lastUpdated}>Last Updated: March 28, 2026</Text>

      <Text style={styles.body}>
        DishDrop ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
      </Text>

      <Text style={styles.heading}>1. Information We Collect</Text>

      <Text style={styles.subheading}>Account Information</Text>
      <Text style={styles.body}>
        When you create an account, we collect your name, email address, and username. This information is necessary to provide you with a personalized experience.
      </Text>

      <Text style={styles.subheading}>Content You Create</Text>
      <Text style={styles.body}>
        We store the photos, reviews, ratings, and comments you post on DishDrop. This content is visible to other users based on your privacy settings.
      </Text>

      <Text style={styles.subheading}>Location Data</Text>
      <Text style={styles.body}>
        With your permission, we collect your location to show nearby restaurants and dishes. Location data is only accessed when you are actively using the app (not in the background). You can disable location access at any time in your device settings.
      </Text>

      <Text style={styles.subheading}>Device Information</Text>
      <Text style={styles.body}>
        We may collect basic device information such as device type and operating system version for app compatibility and crash reporting purposes only.
      </Text>

      <Text style={styles.heading}>2. How We Use Your Information</Text>
      <Text style={styles.body}>
        We use your information solely to:
      </Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Provide, maintain, and improve the DishDrop app</Text>
        <Text style={styles.listItem}>• Display your profile and content to other users</Text>
        <Text style={styles.listItem}>• Show nearby restaurants and dishes based on your location</Text>
        <Text style={styles.listItem}>• Process meal donations and track impact statistics</Text>
        <Text style={styles.listItem}>• Send you notifications about activity on your account (if enabled)</Text>
        <Text style={styles.listItem}>• Enforce our Terms of Service and moderate content</Text>
      </View>

      <Text style={styles.heading}>3. No Third-Party Tracking</Text>
      <Text style={styles.body}>
        DishDrop does not track you across other apps or websites. We do not use third-party analytics or advertising SDKs. We do not sell, rent, or share your personal information with third parties for advertising purposes.
      </Text>

      <Text style={styles.heading}>4. Data Storage and Security</Text>
      <Text style={styles.body}>
        Your data is stored securely on our servers. We use industry-standard encryption and security measures to protect your information. However, no method of electronic storage is 100% secure, and we cannot guarantee absolute security.
      </Text>

      <Text style={styles.heading}>5. Data Sharing</Text>
      <Text style={styles.body}>
        We only share your information in the following limited circumstances:
      </Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• With your consent or at your direction</Text>
        <Text style={styles.listItem}>• To comply with legal obligations or respond to lawful requests</Text>
        <Text style={styles.listItem}>• To protect the rights, safety, or property of DishDrop and its users</Text>
        <Text style={styles.listItem}>• With service providers who assist in operating the app (e.g., cloud hosting), under strict confidentiality agreements</Text>
      </View>

      <Text style={styles.heading}>6. Your Rights</Text>
      <Text style={styles.body}>
        You have the right to:
      </Text>
      <View style={styles.list}>
        <Text style={styles.listItem}>• Access the personal data we hold about you</Text>
        <Text style={styles.listItem}>• Update or correct your information through your profile settings</Text>
        <Text style={styles.listItem}>• Delete your account and all associated data at any time via Settings</Text>
        <Text style={styles.listItem}>• Disable location permissions through your device settings</Text>
        <Text style={styles.listItem}>• Opt out of push notifications</Text>
      </View>

      <Text style={styles.heading}>7. Data Retention</Text>
      <Text style={styles.body}>
        We retain your data for as long as your account is active. When you delete your account, all personal data, posts, and associated content are permanently removed from our servers.
      </Text>

      <Text style={styles.heading}>8. Children's Privacy</Text>
      <Text style={styles.body}>
        DishDrop is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete it.
      </Text>

      <Text style={styles.heading}>9. Changes to This Policy</Text>
      <Text style={styles.body}>
        We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy in the app. Your continued use of DishDrop after changes constitutes acceptance of the updated policy.
      </Text>

      <Text style={styles.heading}>10. Contact Us</Text>
      <Text style={styles.body}>
        If you have questions about this Privacy Policy or your data, contact us at privacy@dishdrop.app.
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
  subheading: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
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

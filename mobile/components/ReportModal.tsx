import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../lib/constants';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'nudity', label: 'Nudity or Sexual Content' },
  { value: 'violence', label: 'Violence or Dangerous Content' },
  { value: 'other', label: 'Other' },
] as const;

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
}

export default function ReportModal({ visible, onClose, targetType, targetId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetLabel = targetType === 'post' ? 'Post' : targetType === 'comment' ? 'Comment' : 'User';

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Please Select a Reason', 'Choose a reason for your report.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.reportContent({
        targetType,
        targetId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our team will review this within 24 hours and take appropriate action.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.container}>
          <ScrollView bounces={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Report {targetLabel}</Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.subtitle}>
              Why are you reporting this {targetType}? Your report is anonymous.
            </Text>

            {/* Reasons */}
            <View style={styles.reasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.value}
                  style={[
                    styles.reasonRow,
                    selectedReason === reason.value && styles.reasonRowSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.value)}
                >
                  <Ionicons
                    name={selectedReason === reason.value ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selectedReason === reason.value ? Colors.accent : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason.value && styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.descriptionLabel}>Additional details (optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Provide more context about this report..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              numberOfLines={3}
            />

            {/* Submit */}
            <Pressable
              style={[styles.submitButton, (!selectedReason || isSubmitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  container: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: FontSizes.xl,
    fontWeight: '700',
  },
  closeButton: {
    padding: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    marginBottom: Spacing.lg,
  },
  reasons: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  reasonRowSelected: {
    backgroundColor: 'rgba(26, 202, 231, 0.1)',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  reasonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  reasonTextSelected: {
    color: Colors.text,
    fontWeight: '500',
  },
  descriptionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  descriptionInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Colors.background,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
});

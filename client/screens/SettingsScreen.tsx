import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function SettingsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { priceSettings, updatePriceSettings, toggleTheme } = useApp();

  const [membership, setMembership] = useState(priceSettings.membership.toString());
  const [studentMonthly, setStudentMonthly] = useState(priceSettings.student_monthly.toString());
  const [regularMonthly, setRegularMonthly] = useState(priceSettings.regular_monthly.toString());
  const [seniorMonthly, setSeniorMonthly] = useState(priceSettings.senior_monthly.toString());
  const [sessionMember, setSessionMember] = useState(priceSettings.session_member.toString());
  const [sessionNonmember, setSessionNonmember] = useState(priceSettings.session_nonmember.toString());

  const handleSave = () => {
    updatePriceSettings({
      membership: parseFloat(membership) || 0,
      student_monthly: parseFloat(studentMonthly) || 0,
      regular_monthly: parseFloat(regularMonthly) || 0,
      senior_monthly: parseFloat(seniorMonthly) || 0,
      session_member: parseFloat(sessionMember) || 0,
      session_nonmember: parseFloat(sessionNonmember) || 0,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Price settings saved successfully!");
  };

  const handleThemeToggle = () => {
    toggleTheme();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderPriceField = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    description?: string
  ) => (
    <View style={styles.fieldContainer}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      {description ? (
        <ThemedText style={[styles.fieldDescription, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      ) : null}
      <View style={[styles.inputContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <ThemedText style={styles.currencySymbol}>P</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <ThemedText type="h3" style={styles.title}>
        Settings
      </ThemedText>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name={isDark ? "moon" : "sun"} size={20} color={theme.primary} />
          <ThemedText type="h4">Appearance</ThemedText>
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <ThemedText style={styles.toggleLabel}>Dark Mode</ThemedText>
            <ThemedText style={[styles.toggleDescription, { color: theme.textSecondary }]}>
              Switch between light and dark theme
            </ThemedText>
          </View>
          <Switch
            value={isDark}
            onValueChange={handleThemeToggle}
            trackColor={{ false: theme.backgroundTertiary, true: theme.primary + "80" }}
            thumbColor={isDark ? theme.primary : theme.backgroundSecondary}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="dollar-sign" size={20} color={theme.primary} />
          <ThemedText type="h4">Membership Fee</ThemedText>
        </View>
        {renderPriceField(
          "Lifetime Membership",
          membership,
          setMembership,
          "One-time registration fee for new members"
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="calendar" size={20} color={theme.primary} />
          <ThemedText type="h4">Monthly Subscription Rates</ThemedText>
        </View>
        {renderPriceField("Student Monthly", studentMonthly, setStudentMonthly)}
        {renderPriceField("Regular Monthly", regularMonthly, setRegularMonthly)}
        {renderPriceField("Senior Monthly", seniorMonthly, setSeniorMonthly)}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="clock" size={20} color={theme.primary} />
          <ThemedText type="h4">Per Session Rates</ThemedText>
        </View>
        {renderPriceField(
          "Session (Member)",
          sessionMember,
          setSessionMember,
          "Rate for registered members without active subscription"
        )}
        {renderPriceField(
          "Session (Non-member)",
          sessionNonmember,
          setSessionNonmember,
          "Rate for walk-in customers"
        )}
      </Card>

      <Pressable
        onPress={handleSave}
        style={[styles.saveButton, { backgroundColor: theme.primary }]}
      >
        <Feather name="save" size={20} color="#FFFFFF" />
        <ThemedText style={styles.saveButtonText}>Save Settings</ThemedText>
      </Pressable>

      <View style={styles.footer}>
        <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
          Powerlift Fitness Gym
        </ThemedText>
        <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
          Developed by Rov - 2025
        </ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    marginBottom: Spacing["2xl"],
  },
  section: {
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  toggleDescription: {
    fontSize: 12,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  fieldDescription: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  currencySymbol: {
    marginRight: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: 12,
  },
});

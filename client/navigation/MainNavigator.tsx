import React, { useState, useEffect } from "react";
import { View, StyleSheet, useWindowDimensions, Pressable, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolate,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

import DashboardScreen from "@/screens/DashboardScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import ScanQRScreen from "@/screens/ScanQRScreen";
import MembersScreen from "@/screens/MembersScreen";
import ReportsScreen from "@/screens/ReportsScreen";
import SettingsScreen from "@/screens/SettingsScreen";

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "register", label: "Register", icon: "user-plus" },
  { key: "scan", label: "Scan QR", icon: "camera" },
  { key: "members", label: "Members", icon: "users" },
  { key: "reports", label: "Reports", icon: "bar-chart-2" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export default function MainNavigator() {
  const { theme, isDark } = useTheme();
  const { toggleTheme } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [isExpanded, setIsExpanded] = useState(width > 768);
  
  const animationProgress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    setIsExpanded(width > 768);
    animationProgress.value = withSpring(width > 768 ? 1 : 0, { damping: 20, stiffness: 200 });
  }, [width]);

  const toggleSidebar = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    animationProgress.value = withSpring(newExpanded ? 1 : 0, { damping: 20, stiffness: 200 });
  };

  const animatedSidebarStyle = useAnimatedStyle(() => ({
    width: interpolate(
      animationProgress.value,
      [0, 1],
      [Spacing.sidebarCollapsed, Spacing.sidebarExpanded]
    ),
  }));

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(animationProgress.value, [0, 1], [0, 180])}deg` }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: animationProgress.value,
    transform: [{ translateX: interpolate(animationProgress.value, [0, 1], [-10, 0]) }],
  }));

  const renderScreen = () => {
    switch (activeScreen) {
      case "dashboard":
        return <DashboardScreen />;
      case "register":
        return <RegisterScreen />;
      case "scan":
        return <ScanQRScreen />;
      case "members":
        return <MembersScreen />;
      case "reports":
        return <ReportsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View
        style={[
          styles.sidebar,
          { backgroundColor: theme.backgroundDefault, borderRightColor: theme.border },
          animatedSidebarStyle,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <View style={styles.sidebarHeader}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/gym-logo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Pressable 
            onPress={toggleSidebar} 
            style={[styles.toggleButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Animated.View style={animatedArrowStyle}>
              <Feather name="chevron-right" size={18} color={theme.text} />
            </Animated.View>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarContent}
        >
          <View style={styles.navItems}>
            {navItems.map((item) => {
              const isActive = activeScreen === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setActiveScreen(item.key)}
                  style={[
                    styles.navItem,
                    isActive && { backgroundColor: theme.primary + "20" },
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={22}
                    color={isActive ? theme.primary : theme.textSecondary}
                  />
                  {isExpanded ? (
                    <Animated.View style={animatedLabelStyle}>
                      <ThemedText
                        style={[
                          styles.navLabel,
                          { color: isActive ? theme.primary : theme.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </ThemedText>
                    </Animated.View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.sidebarFooter, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={toggleTheme}
            style={[styles.themeToggle, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather
              name={isDark ? "sun" : "moon"}
              size={20}
              color={isDark ? theme.warning : theme.primary}
            />
            {isExpanded ? (
              <Animated.View style={animatedLabelStyle}>
                <ThemedText style={[styles.navLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                  {isDark ? "Light Mode" : "Dark Mode"}
                </ThemedText>
              </Animated.View>
            ) : null}
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.content}>{renderScreen()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    borderRightWidth: 1,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
  },
  toggleButton: {
    position: "absolute",
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarContent: {
    flex: 1,
  },
  navItems: {
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.sm,
    gap: Spacing.md,
    minHeight: 44,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  sidebarFooter: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
    minHeight: 44,
  },
  content: {
    flex: 1,
  },
});

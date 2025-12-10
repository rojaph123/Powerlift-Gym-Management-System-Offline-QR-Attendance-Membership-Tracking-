import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius } from "@/constants/theme";

const PIN_KEY = "powerlift_gym_pin";

export default function PinScreen() {
  const { theme } = useTheme();
  const { setAuthenticated, setHasPin } = useApp();
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);

  useEffect(() => {
    checkExistingPin();
  }, []);

  useEffect(() => {
    if (isCreating && !isConfirming && pin.length === 4) {
      setTimeout(() => {
        setIsConfirming(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 200);
    } else if (isCreating && isConfirming && confirmPin.length === 4) {
      setTimeout(() => handleSubmit(), 200);
    } else if (!isCreating && pin.length === 4) {
      setTimeout(() => handleSubmit(), 200);
    }
  }, [pin, confirmPin]);

  const checkExistingPin = async () => {
    try {
      if (Platform.OS === "web") {
        const webPin = localStorage.getItem(PIN_KEY);
        if (webPin) {
          setStoredPin(webPin);
          setHasPin(true);
        } else {
          setIsCreating(true);
        }
      } else {
        const existingPin = await SecureStore.getItemAsync(PIN_KEY);
        if (existingPin) {
          setStoredPin(existingPin);
          setHasPin(true);
        } else {
          setIsCreating(true);
        }
      }
    } catch {
      setIsCreating(true);
    }
  };

  const handleNumberPress = (num: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError("");
    
    if (isCreating && isConfirming) {
      if (confirmPin.length < 4) {
        setConfirmPin(prev => prev + num);
      }
    } else {
      if (pin.length < 4) {
        setPin(prev => prev + num);
      }
    }
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isCreating && isConfirming) {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isCreating && isConfirming) {
      setConfirmPin("");
    } else {
      setPin("");
    }
  };

  const handleSubmit = async () => {
    if (isCreating) {
      if (pin.length !== 4) {
        setError("PIN must be 4 digits");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      if (!isConfirming) {
        setIsConfirming(true);
        return;
      }
      if (pin !== confirmPin) {
        setError("PINs do not match");
        setConfirmPin("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      try {
        if (Platform.OS === "web") {
          localStorage.setItem(PIN_KEY, pin);
        } else {
          await SecureStore.setItemAsync(PIN_KEY, pin);
        }
        setHasPin(true);
        setAuthenticated(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        setError("Failed to save PIN");
      }
    } else {
      if (pin === storedPin) {
        setAuthenticated(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError("Incorrect PIN");
        setPin("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const renderPinDots = (value: string) => {
    return (
      <View style={styles.pinDots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.pinDot,
              {
                backgroundColor: i < value.length ? theme.primary : "transparent",
                borderColor: theme.primary,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderNumberButton = (num: string) => (
    <Pressable
      key={num}
      onPress={() => handleNumberPress(num)}
      style={({ pressed }) => [
        styles.numButton,
        { backgroundColor: pressed ? theme.primary : theme.backgroundSecondary },
      ]}
    >
      <ThemedText style={styles.numButtonText}>{num}</ThemedText>
    </Pressable>
  );

  const getCurrentPin = () => {
    if (isCreating && isConfirming) {
      return confirmPin;
    }
    return pin;
  };

  const getSubtitle = () => {
    if (isCreating) {
      if (isConfirming) {
        return "Confirm your 4-digit PIN";
      }
      return "Create your 4-digit PIN";
    }
    return "Enter your PIN to continue";
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.md },
      ]}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/gym-logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText type="h3" style={styles.title}>
          Powerlift Fitness Gym
        </ThemedText>

        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {getSubtitle()}
        </ThemedText>

        {renderPinDots(getCurrentPin())}

        {error ? (
          <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>
        ) : (
          <View style={styles.errorPlaceholder} />
        )}
      </View>

      <View style={styles.keypadContainer}>
        <View style={styles.keypadRow}>
          {renderNumberButton("1")}
          {renderNumberButton("2")}
          {renderNumberButton("3")}
        </View>
        <View style={styles.keypadRow}>
          {renderNumberButton("4")}
          {renderNumberButton("5")}
          {renderNumberButton("6")}
        </View>
        <View style={styles.keypadRow}>
          {renderNumberButton("7")}
          {renderNumberButton("8")}
          {renderNumberButton("9")}
        </View>
        <View style={styles.keypadRow}>
          <Pressable
            onPress={handleClear}
            onLongPress={handleClear}
            style={({ pressed }) => [
              styles.numButton,
              styles.actionButton,
              { backgroundColor: pressed ? theme.error : "transparent" },
            ]}
          >
            <ThemedText style={[styles.actionButtonText, { color: theme.error }]}>C</ThemedText>
          </Pressable>
          {renderNumberButton("0")}
          <Pressable
            onPress={handleBackspace}
            style={({ pressed }) => [
              styles.numButton,
              styles.actionButton,
              { backgroundColor: pressed ? theme.textSecondary : "transparent" },
            ]}
          >
            <Feather name="delete" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>
        Developed by Rov - 2025
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
    fontSize: 20,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    fontSize: 14,
  },
  pinDots: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  error: {
    marginTop: Spacing.sm,
    fontSize: 14,
    height: 20,
  },
  errorPlaceholder: {
    height: 20,
    marginTop: Spacing.sm,
  },
  keypadContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    maxWidth: 320,
    alignSelf: "center",
    width: "100%",
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  numButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  numButtonText: {
    fontSize: 28,
    fontWeight: "600",
  },
  actionButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 20,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    paddingBottom: Spacing.sm,
  },
});

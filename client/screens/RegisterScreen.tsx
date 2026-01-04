import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, Image, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { setIsPhotoOperationScreen } from "@/components/SessionManager";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BorderRadius } from "@/constants/theme";

type MembershipType = "student" | "regular" | "senior";
type RegistrationOption = "member_only" | "member_monthly" | "member_session";

export default function RegisterScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addMember, addSale, priceSettings, addAttendance } = useApp();

  // Mark this screen as a photo operation screen when mounted
  useEffect(() => {
    setIsPhotoOperationScreen(true);
    console.log('[RegisterScreen] Set photo operation screen: true');
    
    let timer: NodeJS.Timeout;
    return () => {
      // Delay reset to ensure flag persists through background→active transitions
      timer = setTimeout(() => {
        setIsPhotoOperationScreen(false);
        console.log('[RegisterScreen] Reset photo operation screen: false');
      }, 500);
    };
  }, []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [membershipType, setMembershipType] = useState<MembershipType>("regular");
  const [registrationOption, setRegistrationOption] = useState<RegistrationOption>("member_only");

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Camera permission is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setAge("");
    setGender("");
    setEmail("");
    setPhone("");
    setPhoto("");
    setMembershipType("regular");
    setRegistrationOption("member_only");
  };

  const handleRegister = async () => {

    if (!firstName.trim() || !lastName.trim() || !age || !gender) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!photo) {
      Alert.alert("Photo Required", "Please take or select a photo before registering.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const today = new Date();
    let subscriptionStart: string | null = null;
    let subscriptionEnd: string | null = null;

    if (registrationOption === "member_monthly") {
      subscriptionStart = today.toISOString().split("T")[0];
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 1);
      subscriptionEnd = endDate.toISOString().split("T")[0];
    }

    const newMember = await addMember({
  firstname: firstName.trim(),
  lastname: lastName.trim(),
  age: parseInt(age),
  gender,
  email: email.trim(),
  phone: phone.trim(),
  photo,
  membership_type: membershipType,
  is_member: 1,
  subscription_start: subscriptionStart,
  subscription_end: subscriptionEnd,
});


    addSale("membership_fee", priceSettings.membership, `Membership for ${firstName} ${lastName}`);

    if (registrationOption === "member_monthly") {
      const priceKey = `${membershipType}_monthly` as keyof typeof priceSettings;
      addSale(`monthly_${membershipType}`, priceSettings[priceKey] as number, `Monthly subscription for ${firstName} ${lastName}`);
    } else if (registrationOption === "member_session") {
      addSale("session_member", priceSettings.session_member, `Session for ${firstName} ${lastName}`);
  await addAttendance(newMember.id);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", `${firstName} ${lastName} has been registered successfully!`);
    resetForm();
  };

  const renderGenderOption = (value: "male" | "female", label: string) => (
    <Pressable
      onPress={() => setGender(value)}
      style={[
        styles.optionButton,
        { borderColor: theme.border },
        gender === value && { backgroundColor: theme.primary, borderColor: theme.primary },
      ]}
    >
      <ThemedText style={gender === value ? { color: "#FFFFFF" } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderMembershipOption = (value: MembershipType, label: string, price: number) => (
    <Pressable
      onPress={() => setMembershipType(value)}
      style={[
        styles.membershipOption,
        { borderColor: theme.border, backgroundColor: theme.backgroundDefault },
        membershipType === value && { borderColor: theme.primary, backgroundColor: theme.primary + "15" },
      ]}
    >
      <ThemedText style={[styles.membershipLabel, membershipType === value && { color: theme.primary }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.membershipPrice, { color: theme.textSecondary }]}>
        ₱{price}/month
      </ThemedText>
    </Pressable>
  );

  const renderRegistrationOption = (value: RegistrationOption, label: string, description: string) => (
    <Pressable
      onPress={() => setRegistrationOption(value)}
      style={[
        styles.regOption,
        { borderColor: theme.border, backgroundColor: theme.backgroundDefault },
        registrationOption === value && { borderColor: theme.primary, backgroundColor: theme.primary + "15" },
      ]}
    >
      <View style={styles.radioOuter}>
        {registrationOption === value ? (
          <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
        ) : null}
      </View>
      <View style={styles.regOptionText}>
        <ThemedText style={registrationOption === value ? { color: theme.primary } : undefined}>
          {label}
        </ThemedText>
        <ThemedText style={[styles.regOptionDesc, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      </View>
    </Pressable>
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
        Register New Member
      </ThemedText>

      <View style={styles.photoSection}>
        <Pressable onPress={pickImage} style={styles.photoContainer}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="user" size={40} color={theme.textSecondary} />
            </View>
          )}
        </Pressable>
        <View style={styles.photoButtons}>
          <Pressable
            onPress={takePhoto}
            style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="camera" size={18} color={theme.text} />
            <ThemedText style={styles.photoButtonText}>Camera</ThemedText>
          </Pressable>
          <Pressable
            onPress={pickImage}
            style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="image" size={18} color={theme.text} />
            <ThemedText style={styles.photoButtonText}>Gallery</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.formSection}>
        <ThemedText style={styles.label}>First Name *</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Enter first name"
          placeholderTextColor={theme.textSecondary}
        />

        <ThemedText style={styles.label}>Last Name *</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Enter last name"
          placeholderTextColor={theme.textSecondary}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <ThemedText style={styles.label}>Age *</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              value={age}
              onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ""))}
              placeholder="Age"
              keyboardType="number-pad"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          <View style={styles.halfField}>
            <ThemedText style={styles.label}>Gender *</ThemedText>
            <View style={styles.genderRow}>
              {renderGenderOption("male", "Male")}
              {renderGenderOption("female", "Female")}
            </View>
          </View>
        </View>

        <ThemedText style={styles.label}>Email</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter email address"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={theme.textSecondary}
        />

        <ThemedText style={styles.label}>Phone</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.formSection}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Membership Type
        </ThemedText>
        <View style={styles.membershipGrid}>
          {renderMembershipOption("student", "Student", priceSettings.student_monthly)}
          {renderMembershipOption("regular", "Regular", priceSettings.regular_monthly)}
          {renderMembershipOption("senior", "Senior", priceSettings.senior_monthly)}
        </View>
      </View>

      <View style={styles.formSection}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Registration Option
        </ThemedText>
        {renderRegistrationOption("member_only", "Member Only", `Membership fee: ₱${priceSettings.membership}`)}
        {renderRegistrationOption("member_monthly", "Member + Monthly Subscription", `Total: ₱${priceSettings.membership + (priceSettings[`${membershipType}_monthly` as keyof typeof priceSettings] as number)}`)}
        {renderRegistrationOption("member_session", "Member + Per Session", `Total: ₱${priceSettings.membership + priceSettings.session_member}`)}
      </View>

      <Pressable
        onPress={handleRegister}
        disabled={!photo}
        style={[
          styles.registerButton,
          { backgroundColor: theme.primary, opacity: photo ? 1 : 0.6 },
        ]}
      >
        <Feather name="user-plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.registerButtonText}>Register Member</ThemedText>
      </Pressable>
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
  photoSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  photoContainer: {
    marginBottom: Spacing.lg,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  photoButtonText: {
    fontSize: 14,
  },
  formSection: {
    marginBottom: Spacing["2xl"],
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfField: {
    flex: 1,
  },
  genderRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  optionButton: {
    flex: 1,
    height: Spacing.inputHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  membershipGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  membershipOption: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
  },
  membershipLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  membershipPrice: {
    fontSize: 12,
  },
  regOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  regOptionText: {
    flex: 1,
  },
  regOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});

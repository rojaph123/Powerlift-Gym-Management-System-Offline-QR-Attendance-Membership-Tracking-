import React, { useMemo, useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Alert, TextInput, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useHeaderHeight } from "@react-navigation/elements";
import { setIsPhotoOperationScreen } from "@/components/SessionManager";

import { useTheme } from "@/hooks/useTheme";
import { useApp, Member } from "@/context/AppContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Calendar } from "react-native-calendars";

type RouteParams = RouteProp<RootStackParamList, "MemberDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MemberDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { getMember, renewSubscription, paySession, attendance, priceSettings, deleteMember, updateMember } = useApp();

  const member = getMember(route.params.memberId);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editMembershipType, setEditMembershipType] = useState<Member["membership_type"]>("regular");
  const [showDateModal, setShowDateModal] = useState(false);
  const [editingField, setEditingField] = useState<"start" | "end">("end");

  // Mark this screen as a photo operation screen
  useEffect(() => {
    setIsPhotoOperationScreen(true);
    console.log('[MemberDetailScreen] Set photo operation screen: true');
    
    let timer: NodeJS.Timeout;
    return () => {
      // Delay reset to ensure flag persists through background→active transitions
      timer = setTimeout(() => {
        setIsPhotoOperationScreen(false);
        console.log('[MemberDetailScreen] Reset photo operation screen: false');
      }, 500);
    };
  }, []);

  const isActive = useMemo(() => {
    if (!member?.subscription_end) return false;
    const today = new Date().toISOString().split("T")[0];
    return member.subscription_end >= today;
  }, [member?.subscription_end]);

  const memberAttendance = useMemo(() => {
    if (!member) return [];
    return attendance
      .filter((a) => a.member_id === member.id)
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, 10);
  }, [member, attendance]);

  if (!member) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Member not found</ThemedText>
      </View>
    );
  }

  const handleRenew = () => {
    const priceKey = `${member.membership_type}_monthly` as keyof typeof priceSettings;
    const amount = priceSettings[priceKey] as number;
    
    Alert.alert(
      "Renew Subscription",
      `Renew monthly subscription for ₱${amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            renewSubscription(member.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Subscription renewed successfully!");
          },
        },
      ]
    );
  };

  const handlePaySession = () => {
    const isSenior = member.membership_type === "senior";
    const amount = isSenior ? priceSettings.session_member_senior : priceSettings.session_member;
    const rateType = isSenior ? "Senior Member" : "Regular Member";
    
    Alert.alert(
      "Pay Per Session",
      `Record ${rateType} session payment of ₱${amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            void paySession(member.id, true, isSenior);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", `Session payment recorded! Amount: ₱${amount}`);
          },
        },
      ]
    );
  };

  const handleViewCard = () => {
    navigation.navigate("MemberCard", { memberId: member.id });
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Member",
      `Are you sure you want to delete ${member.firstname} ${member.lastname}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMember(member.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const openEditModal = () => {
    setEditFirstName(member.firstname);
    setEditLastName(member.lastname);
    setEditMembershipType(member.membership_type);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert("Missing Information", "Please enter both first and last name.");
      return;
    }

    try {
      await updateMember(member.id, {
        firstname: editFirstName.trim(),
        lastname: editLastName.trim(),
        membership_type: editMembershipType,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Member details updated.");
      setEditModalVisible(false);
    } catch (error) {
      console.error("Failed to update member:", error);
      Alert.alert("Error", "Failed to update member details.");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri;
      try {
        await updateMember(member.id, { photo: uri });
        Haptics.selectionAsync();
      } catch (error) {
        console.error("Failed to update photo:", error);
        Alert.alert("Error", "Unable to update photo.");
      }
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

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri;
      try {
        await updateMember(member.id, { photo: uri });
        Haptics.selectionAsync();
      } catch (error) {
        console.error("Failed to update photo:", error);
        Alert.alert("Error", "Unable to update photo.");
      }
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      "Change Photo",
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: takePhoto },
        { text: "Gallery", onPress: pickImage },
        { text: "Remove Photo", style: "destructive", onPress: async () => {
          try {
            await updateMember(member.id, { photo: "" });
            Haptics.selectionAsync();
          } catch (error) {
            console.error("Failed to remove photo:", error);
            Alert.alert("Error", "Unable to remove photo.");
          }
        } },
      ],
      { cancelable: true }
    );
  };

  const handleEditDate = (field: "start" | "end") => {
    setEditingField(field);
    setShowDateModal(true);
  };

  const handleDateSelect = (day: string) => {
    if (editingField === "start") {
      updateMember(member.id, { subscription_start: day });
    } else {
      updateMember(member.id, { subscription_end: day });
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowDateModal(false);
    Alert.alert("Success", `Subscription ${editingField} date updated to ${day}!`);
  };

  const handleQuickExtend = (days: number) => {
    const currentEnd = member.subscription_end 
      ? new Date(member.subscription_end) 
      : new Date();
    
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + days);
    
    const newDateStr = newEnd.toISOString().split("T")[0];
    updateMember(member.id, { subscription_end: newDateStr });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", `Subscription extended by ${days} days!`);
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={handleChangePhoto}>
            {member.photo ? (
              <Image source={{ uri: member.photo }} style={styles.photo} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="user" size={40} color={theme.textSecondary} />
              </View>
            )}
          </Pressable>
          <ThemedText type="h2" style={styles.name}>
            {member.firstname} {member.lastname}
          </ThemedText>
          <Pressable onPress={openEditModal} style={[styles.editNameButton, { marginTop: 8 }]}>
            <Feather name="edit-2" size={16} color={theme.primary} />
          </Pressable>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isActive ? theme.success + "20" : theme.warning + "20" },
            ]}
          >
            <Feather
              name={isActive ? "check-circle" : "alert-circle"}
              size={16}
              color={isActive ? theme.success : theme.warning}
            />
            <ThemedText style={{ color: isActive ? theme.success : theme.warning, fontWeight: "500" }}>
              {isActive ? "Active" : "Expired"}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <ThemedText style={{ color: theme.textSecondary }}>Membership Type</ThemedText>
            <ThemedText style={styles.infoValue}>
              {member.membership_type.charAt(0).toUpperCase() + member.membership_type.slice(1)}
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.infoRow}>
            <ThemedText style={{ color: theme.textSecondary }}>Age</ThemedText>
            <ThemedText style={styles.infoValue}>{member.age} years old</ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.infoRow}>
            <ThemedText style={{ color: theme.textSecondary }}>Gender</ThemedText>
            <ThemedText style={styles.infoValue}>
              {member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}
            </ThemedText>
          </View>
          {member.email ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.infoRow}>
                <ThemedText style={{ color: theme.textSecondary }}>Email</ThemedText>
                <ThemedText style={styles.infoValue}>{member.email}</ThemedText>
              </View>
            </>
          ) : null}
          {member.phone ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.infoRow}>
                <ThemedText style={{ color: theme.textSecondary }}>Phone</ThemedText>
                <ThemedText style={styles.infoValue}>{member.phone}</ThemedText>
              </View>
            </>
          ) : null}
        </Card>

        <Card style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <ThemedText type="h4">Subscription</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <ThemedText style={{ color: theme.textSecondary }}>Start Date</ThemedText>
            <View style={styles.dateRow}>
              <ThemedText style={styles.infoValue}>{member.subscription_start || "N/A"}</ThemedText>
              <Pressable 
                onPress={() => handleEditDate("start")} 
                style={[styles.editButton, { backgroundColor: theme.primary + "20" }]}
              >
                <Feather name="edit-2" size={14} color={theme.primary} />
              </Pressable>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.infoRow}>
            <ThemedText style={{ color: theme.textSecondary }}>End Date</ThemedText>
            <View style={styles.dateRow}>
              <ThemedText style={styles.infoValue}>{member.subscription_end || "N/A"}</ThemedText>
              <Pressable 
                onPress={() => handleEditDate("end")} 
                style={[styles.editButton, { backgroundColor: theme.primary + "20" }]}
              >
                <Feather name="edit-2" size={14} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.quickExtendSection}>
            <ThemedText style={[styles.quickExtendLabel, { color: theme.textSecondary }]}>
              Quick Extend:
            </ThemedText>
            <View style={styles.quickExtendButtons}>
              <Pressable 
                onPress={() => handleQuickExtend(7)} 
                style={[styles.quickExtendButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={styles.quickExtendButtonText}>+7 days</ThemedText>
              </Pressable>
              <Pressable 
                onPress={() => handleQuickExtend(30)} 
                style={[styles.quickExtendButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={styles.quickExtendButtonText}>+30 days</ThemedText>
              </Pressable>
              <Pressable 
                onPress={() => handleQuickExtend(90)} 
                style={[styles.quickExtendButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={styles.quickExtendButtonText}>+90 days</ThemedText>
              </Pressable>
            </View>
          </View>
        </Card>

        <View style={styles.actionButtons}>
          <Pressable
            onPress={handleRenew}
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="refresh-cw" size={18} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Renew Subscription</ThemedText>
          </Pressable>
          <Pressable
            onPress={handlePaySession}
            style={[styles.actionButton, { backgroundColor: theme.success }]}
          >
            <Feather name="dollar-sign" size={18} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Pay Per Session</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleViewCard}
            style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="credit-card" size={18} color={theme.text} />
            <ThemedText>View Membership Card</ThemedText>
          </Pressable>
        </View>

        <Card style={styles.attendanceCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Recent Attendance
          </ThemedText>
          {memberAttendance.length > 0 ? (
            memberAttendance.map((a, index) => (
              <View key={a.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                <View style={styles.attendanceRow}>
                  <Feather name="log-in" size={16} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary }}>{a.date}</ThemedText>
                  <ThemedText>{a.time}</ThemedText>
                </View>
              </View>
            ))
          ) : (
            <ThemedText style={{ color: theme.textSecondary }}>No attendance records</ThemedText>
          )}
        </Card>

        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Feather name="trash-2" size={18} color={theme.error} />
          <ThemedText style={{ color: theme.error }}>Delete Member</ThemedText>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.modalTitle}>
              Select {editingField === "start" ? "Start" : "End"} Date
            </ThemedText>
            
            <Calendar
              onDayPress={(day) => handleDateSelect(day.dateString)}
              markedDates={{
                [editingField === "start" ? (member.subscription_start || new Date().toISOString().split("T")[0]) : (member.subscription_end || new Date().toISOString().split("T")[0])]: {
                  selected: true,
                  selectedColor: theme.primary,
                }
              }}
              theme={{
                backgroundColor: theme.backgroundDefault,
                calendarBackground: theme.backgroundDefault,
                textSectionTitleColor: theme.text,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: "#FFFFFF",
                todayTextColor: theme.primary,
                dayTextColor: theme.text,
                textDisabledColor: theme.textSecondary,
                dotColor: theme.primary,
                monthTextColor: theme.text,
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13,
              }}
            />
            
            <Pressable
              onPress={() => setShowDateModal(false)}
              style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary, marginTop: Spacing.lg }]}
            >
              <ThemedText>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.modalTitle}>Edit Member</ThemedText>

            <ThemedText style={[styles.modalHint, { color: theme.textSecondary }]}>First Name</ThemedText>
            <TextInput
              style={[styles.dateInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="First name"
              placeholderTextColor={theme.textSecondary}
            />

            <ThemedText style={[styles.modalHint, { color: theme.textSecondary }]}>Last Name</ThemedText>
            <TextInput
              style={[styles.dateInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="Last name"
              placeholderTextColor={theme.textSecondary}
            />

            <ThemedText style={[styles.modalHint, { color: theme.textSecondary }]}>Membership Type</ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
              {(['student','regular','senior'] as Member['membership_type'][]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setEditMembershipType(t)}
                  style={[
                    { paddingVertical: 10, paddingHorizontal: 12, borderRadius: BorderRadius.sm },
                    editMembershipType === t ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText style={editMembershipType === t ? { color: '#fff' } : undefined}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Pressable onPress={() => setEditModalVisible(false)} style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={handleSaveEdit} style={[styles.modalButton, { backgroundColor: theme.primary }]}>
                <ThemedText style={{ color: '#FFFFFF' }}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: Spacing.lg,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  name: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  infoCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  subscriptionCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  editNameButton: {
    padding: Spacing.xs,
  },
  infoValue: {
    fontWeight: "500",
  },
  divider: {
    height: 1,
  },
  quickExtendSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  quickExtendLabel: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  quickExtendButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  quickExtendButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  quickExtendButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtons: {
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  attendanceCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  attendanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  modalHint: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  dateInput: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    textAlign: "center",
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

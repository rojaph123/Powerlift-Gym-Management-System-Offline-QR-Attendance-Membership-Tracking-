import React, { useRef, useState } from "react";
import { View, StyleSheet, Image, Pressable, Platform, Alert, ScrollView, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import ViewShot from "react-native-view-shot";
import QRCode from "react-native-qrcode-svg";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteParams = RouteProp<RootStackParamList, "MemberCard">;

export default function MemberCardScreen() {
  const { theme } = useTheme();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { getMember } = useApp();
  const viewShotRef = useRef<ViewShot>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  const member = getMember(route.params.memberId);

  if (!member) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Member not found</ThemedText>
      </ThemedView>
    );
  }

  const handleShare = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Sharing is not available on web. Please use Expo Go on your mobile device.");
      return;
    }

    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to share membership card.");
    }
  };

  const handleDownloadPNG = async () => {
    if (Platform.OS === "web") {
      try {
        if (viewShotRef.current?.capture) {
          const uri = await viewShotRef.current.capture();
          const link = document.createElement("a");
          link.href = uri;
          link.download = `${member.firstname}_${member.lastname}_membership_card.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          Alert.alert("Success", "Membership card downloaded as PNG!");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to download PNG on web.");
      }
      return;
    }

    setIsDownloading(true);
    try {
      if (!mediaPermission?.granted) {
        const permission = await requestMediaPermission();
        if (!permission.granted) {
          if (permission.status === "denied" && !permission.canAskAgain && Platform.OS !== ("web" as any)) {
 
            Alert.alert(
              "Permission Required",
              "Media library permission is required to save images. Please enable it in your device settings.",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Open Settings", 
                  onPress: async () => {
                    try {
                      await Linking.openSettings();
                    } catch {
                      // Settings not available
                    }
                  }
                },
              ]
            );
          } else {
            Alert.alert("Permission Required", "Please grant media library permission to save images.");
          }
          setIsDownloading(false);
          return;
        }
      }

      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        const fileName = `${member.firstname}_${member.lastname}_membership_card.png`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.copyAsync({
          from: uri,
          to: fileUri,
        });

        const asset = await MediaLibrary.createAssetAsync(fileUri);
        await MediaLibrary.createAlbumAsync("Powerlift Gym", asset, false);
        
        Alert.alert("Success", "Membership card saved to your photo library!");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to download membership card as PNG.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      let imageBase64 = "";
      
      if (viewShotRef.current?.capture) {
        if (Platform.OS !== "web") {
         const base64 = await viewShotRef.current.capture();

          imageBase64 = `data:image/png;base64,${base64}`;
        } else {
          const uri = await viewShotRef.current.capture();
          imageBase64 = uri;
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Membership Card - ${member.firstname} ${member.lastname}</title>
            <style>
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                background-color: #f0f0f0;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              }
              .card-container {
                max-width: 400px;
                width: 100%;
              }
              .card {
                background: #1A1A1A;
                border-radius: 16px;
                overflow: hidden;
                border: 2px solid #DC2626;
              }
              .header {
                display: flex;
                align-items: center;
                padding: 20px;
                background: #0F0F0F;
                gap: 12px;
              }
              .logo {
                width: 50px;
                height: 50px;
                border-radius: 8px;
                object-fit: contain;
              }
              .gym-name {
                color: #FFFFFF;
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 2px;
                margin: 0;
              }
              .gym-subtitle {
                color: #CCCCCC;
                font-size: 12px;
                letter-spacing: 3px;
                margin: 0;
              }
              .body {
                padding: 20px;
              }
              .member-section {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 20px;
              }
              .member-photo {
                width: 70px;
                height: 70px;
                border-radius: 35px;
                border: 2px solid #DC2626;
                object-fit: cover;
              }
              .member-placeholder {
                width: 70px;
                height: 70px;
                border-radius: 35px;
                background: #333;
                border: 2px solid #DC2626;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #666;
                font-size: 30px;
              }
              .member-name {
                color: #FFFFFF;
                font-size: 18px;
                font-weight: 600;
                margin: 0 0 4px 0;
              }
              .member-type {
                color: #DC2626;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 1px;
                margin: 0;
              }
              .qr-section {
                text-align: center;
              }
              .qr-container {
                background: #FFFFFF;
                padding: 12px;
                border-radius: 8px;
                display: inline-block;
                margin-bottom: 12px;
              }
              .qr-code {
                color: #CCCCCC;
                font-size: 14px;
                font-family: monospace;
                letter-spacing: 2px;
              }
              .footer {
                text-align: center;
                padding: 16px;
                background: #0F0F0F;
              }
              .footer-text {
                color: #999999;
                font-size: 11px;
                letter-spacing: 1px;
                margin: 0;
              }
              .card-image {
                max-width: 100%;
                border-radius: 16px;
              }
            </style>
          </head>
          <body>
            <div class="card-container">
              ${imageBase64 ? `<img src="${imageBase64}" class="card-image" alt="Membership Card" />` : `
              <div class="card">
                <div class="header">
                  <div class="logo-placeholder" style="width: 50px; height: 50px; background: #333; border-radius: 8px;"></div>
                  <div>
                    <p class="gym-name">POWERLIFT</p>
                    <p class="gym-subtitle">FITNESS GYM</p>
                  </div>
                </div>
                <div class="body">
                  <div class="member-section">
                    ${member.photo ? `<img src="${member.photo}" class="member-photo" />` : '<div class="member-placeholder">U</div>'}
                    <div>
                      <p class="member-name">${member.firstname} ${member.lastname}</p>
                      <p class="member-type">${member.membership_type.toUpperCase()} MEMBER</p>
                    </div>
                  </div>
                  <div class="qr-section">
                    <div class="qr-container">
                      <p style="font-size: 16px; margin: 0;">QR Code: ${member.qr_code}</p>
                    </div>
                    <p class="qr-code">${member.qr_code}</p>
                  </div>
                </div>
                <div class="footer">
                  <p class="footer-text">Present this card upon entry</p>
                </div>
              </div>
              `}
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
        Alert.alert("Success", "PDF ready for printing!");
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to generate PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1 }}
        style={styles.cardContainer}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Image
              source={require("../../assets/images/gym-logo.jpg")}
              style={styles.cardLogo}
              resizeMode="contain"
            />
            <View style={styles.cardHeaderText}>
              <ThemedText
                style={styles.cardGymName}
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
              >
                POWERLIFT
              </ThemedText>
              <ThemedText
                style={styles.cardGymSubtitle}
                lightColor="#CCCCCC"
                darkColor="#CCCCCC"
              >
                FITNESS GYM
              </ThemedText>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.memberSection}>
              {member.photo ? (
                <Image source={{ uri: member.photo }} style={styles.cardPhoto} />
              ) : (
                <View style={styles.cardPhotoPlaceholder}>
                  <Feather name="user" size={30} color="#666" />
                </View>
              )}
              <View style={styles.memberDetails}>
                <ThemedText
                  style={styles.memberName}
                  lightColor="#FFFFFF"
                  darkColor="#FFFFFF"
                >
                  {member.firstname} {member.lastname}
                </ThemedText>
                <ThemedText
                  style={styles.memberType}
                  lightColor="#DC2626"
                  darkColor="#DC2626"
                >
                  {member.membership_type.toUpperCase()} MEMBER
                </ThemedText>
              </View>
            </View>

            <View style={styles.qrSection}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={member.qr_code}
                  size={120}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              </View>
              <ThemedText
                style={styles.qrCode}
                lightColor="#CCCCCC"
                darkColor="#CCCCCC"
              >
                {member.qr_code}
              </ThemedText>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <ThemedText
              style={styles.footerText}
              lightColor="#999999"
              darkColor="#999999"
            >
              Present this card upon entry
            </ThemedText>
          </View>
        </View>
      </ViewShot>

      <View style={styles.buttonContainer}>
        <Pressable
          onPress={handleDownloadPNG}
          disabled={isDownloading}
          style={[styles.downloadButton, { backgroundColor: theme.primary }]}
        >
          {isDownloading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="image" size={20} color="#FFFFFF" />
              <ThemedText style={styles.buttonText}>Download PNG</ThemedText>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleDownloadPDF}
          disabled={isDownloading}
          style={[styles.downloadButton, { backgroundColor: theme.success }]}
        >
          {isDownloading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="file-text" size={20} color="#FFFFFF" />
              <ThemedText style={styles.buttonText}>Download PDF</ThemedText>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={[styles.downloadButton, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="share-2" size={20} color={theme.text} />
          <ThemedText>Share Card</ThemedText>
        </Pressable>
      </View>

      <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
        Save or share your membership card to show when entering the gym
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#1A1A1A",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#DC2626",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    backgroundColor: "#0F0F0F",
    gap: Spacing.md,
  },
  cardLogo: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardGymName: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
  },
  cardGymSubtitle: {
    fontSize: 12,
    letterSpacing: 3,
  },
  cardBody: {
    padding: Spacing.xl,
  },
  memberSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  cardPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "#DC2626",
  },
  cardPhotoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#DC2626",
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  memberType: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  qrSection: {
    alignItems: "center",
  },
  qrContainer: {
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  qrCode: {
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  cardFooter: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    backgroundColor: "#0F0F0F",
  },
  footerText: {
    fontSize: 11,
    letterSpacing: 1,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  hint: {
    textAlign: "center",
    marginTop: Spacing.xl,
    fontSize: 14,
  },
});

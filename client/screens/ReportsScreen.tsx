import React, { useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";

type FilterPeriod = "daily" | "weekly" | "monthly" | "annual";

const SALE_TYPE_LABELS: Record<string, string> = {
  membership_fee: "Membership Fee",
  monthly_student: "Monthly (Student)",
  monthly_regular: "Monthly (Regular)",
  monthly_senior: "Monthly (Senior)",
  session_member: "Session (Member)",
  session_nonmember: "Session (Non-member)",
};

export default function ReportsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { sales, attendance, members } = useApp();
  const [filter, setFilter] = useState<FilterPeriod>("daily");
  const [isExporting, setIsExporting] = useState(false);

  const getDateRange = (period: FilterPeriod): { start: string; end: string } => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];
    let start: string;

    switch (period) {
      case "daily":
        start = end;
        break;
      case "weekly":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo.toISOString().split("T")[0];
        break;
      case "monthly":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        start = monthAgo.toISOString().split("T")[0];
        break;
      case "annual":
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        start = yearAgo.toISOString().split("T")[0];
        break;
      default:
        start = end;
    }

    return { start, end };
  };

  const { filteredSales, filteredAttendance, totalEarnings, salesByType, earningsByDate } = useMemo(() => {
    const { start, end } = getDateRange(filter);
    
    const fSales = sales.filter(s => s.date >= start && s.date <= end);
    const fAttendance = attendance.filter(a => a.date >= start && a.date <= end);
    
    const total = fSales.reduce((sum, s) => sum + s.amount, 0);
    
    const byType: Record<string, number> = {};
    fSales.forEach(s => {
      byType[s.type] = (byType[s.type] || 0) + s.amount;
    });

    const byDate: Record<string, number> = {};
    fSales.forEach(s => {
      byDate[s.date] = (byDate[s.date] || 0) + s.amount;
    });

    return {
      filteredSales: fSales,
      filteredAttendance: fAttendance,
      totalEarnings: total,
      salesByType: byType,
      earningsByDate: byDate,
    };
  }, [sales, attendance, filter]);

  const maxEarning = useMemo(() => {
    const values = Object.values(earningsByDate);
    return values.length > 0 ? Math.max(...values) : 1;
  }, [earningsByDate]);

  const generateCSV = (): string => {
    let csv = "Date,Type,Amount,Note\n";
    filteredSales.forEach(s => {
      csv += `${s.date},"${SALE_TYPE_LABELS[s.type] || s.type}",${s.amount},"${s.note || ''}"\n`;
    });
    return csv;
  };

  const generateMembersCSV = (): string => {
    let csv = "ID,First Name,Last Name,Age,Gender,Email,Phone,Membership Type,Status,Subscription End\n";
    const today = new Date().toISOString().split("T")[0];
    members.forEach(m => {
      const status = m.subscription_end && m.subscription_end >= today ? "Active" : "Expired";
      csv += `${m.id},"${m.firstname}","${m.lastname}",${m.age},"${m.gender}","${m.email || ''}","${m.phone || ''}","${m.membership_type}","${status}","${m.subscription_end || 'N/A'}"\n`;
    });
    return csv;
  };

  const generateSalesReportHTML = (): string => {
    const { start, end } = getDateRange(filter);
    const today = new Date().toLocaleDateString();
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sales Report - Powerlift Fitness Gym</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #DC2626; padding-bottom: 20px; }
    .header h1 { color: #DC2626; font-size: 24px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 12px; }
    .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
    .summary-card { text-align: center; padding: 15px 30px; border: 1px solid #ddd; border-radius: 8px; }
    .summary-card h3 { font-size: 24px; color: #DC2626; }
    .summary-card p { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; color: #333; }
    tr:nth-child(even) { background-color: #fafafa; }
    .total-row { font-weight: bold; background-color: #f0f0f0 !important; }
    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
    .section-title { margin: 20px 0 10px; font-size: 16px; color: #333; }
    .amount { text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>POWERLIFT FITNESS GYM</h1>
    <p>Sales Report - ${filter.charAt(0).toUpperCase() + filter.slice(1)}</p>
    <p>Period: ${start} to ${end} | Generated: ${today}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>P${totalEarnings.toLocaleString()}</h3>
      <p>Total Earnings</p>
    </div>
    <div class="summary-card">
      <h3>${filteredSales.length}</h3>
      <p>Transactions</p>
    </div>
    <div class="summary-card">
      <h3>${filteredAttendance.length}</h3>
      <p>Check-ins</p>
    </div>
  </div>

  <h2 class="section-title">Sales by Category</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(salesByType).map(([type, amount]) => `
        <tr>
          <td>${SALE_TYPE_LABELS[type] || type}</td>
          <td class="amount">P${Number(amount).toLocaleString()}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="amount">P${totalEarnings.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <h2 class="section-title">Transaction Details</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th class="amount">Amount</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${filteredSales.map(s => `
        <tr>
          <td>${s.date}</td>
          <td>${SALE_TYPE_LABELS[s.type] || s.type}</td>
          <td class="amount">P${s.amount.toLocaleString()}</td>
          <td>${s.note || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Powerlift Fitness Gym - Developed by Rov - 2025</p>
  </div>
</body>
</html>
    `;
  };

  const generateMembersReportHTML = (): string => {
    const today = new Date().toISOString().split("T")[0];
    const todayFormatted = new Date().toLocaleDateString();
    const activeMembers = members.filter(m => m.subscription_end && m.subscription_end >= today);
    const expiredMembers = members.filter(m => !m.subscription_end || m.subscription_end < today);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Members List - Powerlift Fitness Gym</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #DC2626; padding-bottom: 20px; }
    .header h1 { color: #DC2626; font-size: 24px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 12px; }
    .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
    .summary-card { text-align: center; padding: 15px 30px; border: 1px solid #ddd; border-radius: 8px; }
    .summary-card h3 { font-size: 24px; }
    .summary-card.active h3 { color: #22C55E; }
    .summary-card.expired h3 { color: #F59E0B; }
    .summary-card.total h3 { color: #DC2626; }
    .summary-card p { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; font-weight: bold; color: #333; }
    tr:nth-child(even) { background-color: #fafafa; }
    .status-active { color: #22C55E; font-weight: bold; }
    .status-expired { color: #F59E0B; font-weight: bold; }
    .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
    .section-title { margin: 20px 0 10px; font-size: 16px; color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <h1>POWERLIFT FITNESS GYM</h1>
    <p>Members List | Generated: ${todayFormatted}</p>
  </div>

  <div class="summary">
    <div class="summary-card total">
      <h3>${members.length}</h3>
      <p>Total Members</p>
    </div>
    <div class="summary-card active">
      <h3>${activeMembers.length}</h3>
      <p>Active</p>
    </div>
    <div class="summary-card expired">
      <h3>${expiredMembers.length}</h3>
      <p>Expired</p>
    </div>
  </div>

  <h2 class="section-title">All Members</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>Age</th>
        <th>Gender</th>
        <th>Type</th>
        <th>Phone</th>
        <th>Status</th>
        <th>Expires</th>
      </tr>
    </thead>
    <tbody>
      ${members.map((m, i) => {
        const isActive = m.subscription_end && m.subscription_end >= today;
        return `
        <tr>
          <td>${i + 1}</td>
          <td>${m.firstname} ${m.lastname}</td>
          <td>${m.age}</td>
          <td style="text-transform: capitalize;">${m.gender}</td>
          <td style="text-transform: capitalize;">${m.membership_type}</td>
          <td>${m.phone || '-'}</td>
          <td class="${isActive ? 'status-active' : 'status-expired'}">${isActive ? 'Active' : 'Expired'}</td>
          <td>${m.subscription_end || 'N/A'}</td>
        </tr>
      `}).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Powerlift Fitness Gym - Developed by Rov - 2025</p>
  </div>
</body>
</html>
    `;
  };

  const handleExportCSV = async () => {
    const csv = generateCSV();
    
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales_report_${filter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const fileUri = (FileSystem.documentDirectory || '') + `sales_report_${filter}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
      } else {
        await Share.share({ message: csv, title: `sales_report_${filter}.csv` });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to export CSV report.");
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const html = generateSalesReportHTML();
      
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
        return;
      }

      const fileName = `sales_report_${filter}_${Date.now()}`;
      
      try {
        const { uri } = await Print.printToFileAsync({ html });
        const isSharingAvailable = await Sharing.isAvailableAsync();
        
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
        } else {
          const destPath = (FileSystem.documentDirectory || '') + `${fileName}.pdf`;
          await FileSystem.copyAsync({ from: uri, to: destPath });
          Alert.alert("Success", `PDF saved locally. File: ${fileName}.pdf`);
        }
      } catch (printError) {
        const htmlPath = (FileSystem.documentDirectory || '') + `${fileName}.html`;
        await FileSystem.writeAsStringAsync(htmlPath, html);
        Alert.alert(
          "PDF Unavailable", 
          `Print service not available offline. Report saved as HTML file: ${fileName}.html`
        );
      }
    } catch (error) {
      console.log("PDF export error:", error);
      Alert.alert("Error", "Failed to generate report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMembersCSV = async () => {
    const csv = generateMembersCSV();

    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "members_list.csv";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const fileUri = (FileSystem.documentDirectory || '') + "members_list.csv";
      await FileSystem.writeAsStringAsync(fileUri, csv);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
      } else {
        await Share.share({ message: csv, title: "members_list.csv" });
      }
    } catch {
      Alert.alert("Error", "Failed to export members list.");
    }
  };

  const handleExportMembersPDF = async () => {
    setIsExporting(true);
    try {
      const html = generateMembersReportHTML();
      
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
        return;
      }

      const fileName = `members_list_${Date.now()}`;

      try {
        const { uri } = await Print.printToFileAsync({ html });
        const isSharingAvailable = await Sharing.isAvailableAsync();
        
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
        } else {
          const destPath = (FileSystem.documentDirectory || '') + `${fileName}.pdf`;
          await FileSystem.copyAsync({ from: uri, to: destPath });
          Alert.alert("Success", `PDF saved locally. File: ${fileName}.pdf`);
        }
      } catch (printError) {
        const htmlPath = (FileSystem.documentDirectory || '') + `${fileName}.html`;
        await FileSystem.writeAsStringAsync(htmlPath, html);
        Alert.alert(
          "PDF Unavailable", 
          `Print service not available offline. Report saved as HTML file: ${fileName}.html`
        );
      }
    } catch (error) {
      console.log("PDF export error:", error);
      Alert.alert("Error", "Failed to generate report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderFilterButton = (period: FilterPeriod, label: string) => (
    <Pressable
      onPress={() => setFilter(period)}
      style={[
        styles.filterButton,
        { borderColor: theme.border },
        filter === period && { backgroundColor: theme.primary, borderColor: theme.primary },
      ]}
    >
      <ThemedText style={filter === period ? { color: "#FFFFFF" } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <ThemedText type="h3" style={styles.title}>
        Reports
      </ThemedText>

      <View style={styles.filterRow}>
        {renderFilterButton("daily", "Daily")}
        {renderFilterButton("weekly", "Weekly")}
        {renderFilterButton("monthly", "Monthly")}
        {renderFilterButton("annual", "Annual")}
      </View>

      <View style={styles.summaryRow}>
        <Card style={{ ...styles.summaryCard, borderLeftColor: theme.success, borderLeftWidth: 4 }}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Total Earnings
          </ThemedText>
          <ThemedText type="h3">P{totalEarnings.toLocaleString()}</ThemedText>
        </Card>
        <Card style={{ ...styles.summaryCard, borderLeftColor: theme.primary, borderLeftWidth: 4 }}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Total Attendance
          </ThemedText>
          <ThemedText type="h3">{filteredAttendance.length}</ThemedText>
        </Card>
      </View>

      <Card style={styles.chartCard}>
        <ThemedText type="h4" style={styles.chartTitle}>
          Earnings Overview
        </ThemedText>
        {Object.keys(earningsByDate).length > 0 ? (
          <View style={styles.chartContainer}>
            {Object.entries(earningsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-7)
              .map(([date, amount]) => (
                <View key={date} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(amount / maxEarning) * 100}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: theme.textSecondary }]}>
                    {date.slice(5)}
                  </ThemedText>
                </View>
              ))}
          </View>
        ) : (
          <ThemedText style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.xl }}>
            No data for selected period
          </ThemedText>
        )}
      </Card>

      <Card style={styles.breakdownCard}>
        <ThemedText type="h4" style={styles.breakdownTitle}>
          Sales Breakdown
        </ThemedText>
        {Object.entries(salesByType).length > 0 ? (
          Object.entries(salesByType).map(([type, amount]) => (
            <View key={type} style={styles.breakdownRow}>
              <ThemedText>{SALE_TYPE_LABELS[type] || type}</ThemedText>
              <ThemedText style={{ fontWeight: "600" }}>P{amount.toLocaleString()}</ThemedText>
            </View>
          ))
        ) : (
          <ThemedText style={{ color: theme.textSecondary }}>
            No sales for selected period
          </ThemedText>
        )}
      </Card>

      <View style={styles.exportSection}>
        <ThemedText type="h4" style={styles.exportTitle}>
          Export Sales Report
        </ThemedText>
        <View style={styles.exportButtons}>
          <Pressable
            onPress={handleExportPDF}
            disabled={isExporting}
            style={[styles.exportButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="file-text" size={18} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "500" }}>
              {isExporting ? "Generating..." : "Download PDF"}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleExportCSV}
            style={[styles.exportButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="download" size={18} color={theme.text} />
            <ThemedText>Download CSV</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.exportSection}>
        <ThemedText type="h4" style={styles.exportTitle}>
          Export Members List
        </ThemedText>
        <View style={styles.exportButtons}>
          <Pressable
            onPress={handleExportMembersPDF}
            disabled={isExporting}
            style={[styles.exportButton, { backgroundColor: theme.success }]}
          >
            <Feather name="users" size={18} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "500" }}>
              {isExporting ? "Generating..." : "Download PDF"}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleExportMembersCSV}
            style={[styles.exportButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="download" size={18} color={theme.text} />
            <ThemedText>Download CSV</ThemedText>
          </Pressable>
        </View>
      </View>
    </ScrollView>
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
    marginBottom: Spacing.xl,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
    flexWrap: "wrap",
  },
  filterButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.lg,
  },
  summaryLabel: {
    marginBottom: Spacing.xs,
  },
  chartCard: {
    marginBottom: Spacing["2xl"],
    padding: Spacing.xl,
  },
  chartTitle: {
    marginBottom: Spacing.xl,
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 150,
    alignItems: "flex-end",
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    flex: 1,
    width: "60%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: Spacing.xs,
  },
  breakdownCard: {
    marginBottom: Spacing["2xl"],
    padding: Spacing.xl,
  },
  breakdownTitle: {
    marginBottom: Spacing.lg,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  exportSection: {
    marginBottom: Spacing.xl,
  },
  exportTitle: {
    marginBottom: Spacing.lg,
  },
  exportButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    flexWrap: "wrap",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    minWidth: 150,
    justifyContent: "center",
  },
});

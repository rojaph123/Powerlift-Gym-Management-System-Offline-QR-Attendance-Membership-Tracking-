import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { Appearance, Platform, AppState as RNAppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as database from "@/lib/database";

export interface Member {
  id: number;
  firstname: string;
  lastname: string;
  age: number;
  gender: string;
  email: string;
  phone: string;
  photo: string;
  qr_code: string;
  qr_image_path: string;
  membership_type: "student" | "regular" | "senior";
  is_member: number;
  subscription_start: string | null;
  subscription_end: string | null;
}

export interface Attendance {
  id: number;
  member_id: number;
  date: string;
  time: string;
}

export interface Sale {
  id: number;
  type: string;
  amount: number;
  date: string;
  note: string;
}

export interface PriceSettings {
  id: number;
  membership: number;
  student_monthly: number;
  regular_monthly: number;
  senior_monthly: number;
  session_member: number;
  session_nonmember: number;
  session_member_senior: number;
  session_nonmember_senior: number;
}

interface AppState {
  isAuthenticated: boolean;
  hasPin: boolean;
  isDarkMode: boolean;
  members: Member[];
  attendance: Attendance[];
  sales: Sale[];
  priceSettings: PriceSettings;
  isLoading: boolean;
  timeoutDisabled: boolean; // NEW
  appWentToBackground: boolean;
}

interface AppContextType extends AppState {
  setAuthenticated: (value: boolean) => void;
  setHasPin: (value: boolean) => void;
  toggleTheme: () => void;
  setDarkMode: (value: boolean) => void;
  setTimeoutDisabled: (value: boolean) => void; // NEW
  setAppWentToBackground: (value: boolean) => void;
  addMember: (
    member: Omit<Member, "id" | "qr_code" | "qr_image_path">
  ) => Promise<Member>;
  updateMember: (id: number, updates: Partial<Member>) => Promise<void>;
  deleteMember: (id: number) => Promise<void>;
  getMember: (id: number) => Member | undefined;
  getMemberByQR: (qrCode: string) => Member | undefined;
  addAttendance: (memberId: number) => Promise<void>;
  addSale: (type: string, amount: number, note: string) => Promise<void>;
  updatePriceSettings: (settings: Partial<PriceSettings>) => Promise<void>;
  getTodayAttendance: () => Attendance[];
  getTodaySales: () => number;
  getActiveMembers: () => Member[];
  getExpiredMembers: () => Member[];
  renewSubscription: (memberId: number) => Promise<void>;
  paySession: (memberId: number, isMember: boolean, isSenior?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
  backupAllData: () => Promise<string>;
  restoreFromBackup: (backupData: string) => Promise<void>;
}

const defaultPriceSettings: PriceSettings = {
  id: 1,
  membership: 1500,
  student_monthly: 500,
  regular_monthly: 700,
  senior_monthly: 400,
  session_member: 50,
  session_nonmember: 80,
  session_member_senior: 40,
  session_nonmember_senior: 60,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const PIN_STORAGE_KEY = "powerlift_gym_pin";

async function getStoredPin(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(PIN_STORAGE_KEY);
    }
    return await SecureStore.getItemAsync(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function checkHasPin(): Promise<boolean> {
  const pin = await getStoredPin();
  return !!pin;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    hasPin: false,
    isDarkMode: Appearance.getColorScheme() === "dark",
    members: [],
    attendance: [],
    sales: [],
    priceSettings: defaultPriceSettings,
    isLoading: true,
    timeoutDisabled: false, // NEW DEFAULT
    appWentToBackground: false,
  });

  const loadDataFromDatabase = useCallback(async () => {
    try {
      const [
        members,
        attendance,
        sales,
        priceSettings,
        appSettings,
        hasPinStored,
      ] = await Promise.all([
        database.getAllMembers(),
        database.getAllAttendance(),
        database.getAllSales(),
        database.getPriceSettings(),
        database.getAppSettings(),
        checkHasPin(),
      ]);

      const dbDarkMode = appSettings?.is_dark_mode === 1;

      setState((prev) => ({
        ...prev,
        members: members.map((m) => ({
          ...m,
          email: m.email || "",
          phone: m.phone || "",
          photo: m.photo || "",
          qr_image_path: m.qr_image_path || "",
          membership_type: m.membership_type as "student" | "regular" | "senior",
        })),
        attendance,
        sales: sales.map((s) => ({ ...s, note: s.note || "" })),
        priceSettings,
        isDarkMode: dbDarkMode,
        hasPin: hasPinStored,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to load data from database:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Initialize app lifecycle handlers once on mount
  useEffect(() => {
    const cleanup = database.initializeAppLifecycleHandlers();
    console.log('[AppContext] App lifecycle handlers initialized');
    
    // Add background state monitoring
    const appStateSubscription = RNAppState.addEventListener('change', (state) => {
      if (state === 'background') {
        console.log('[AppContext] App entered background - marking for PIN re-entry');
        setState(prev => ({ ...prev, appWentToBackground: true }));
      } else if (state === 'active') {
        console.log('[AppContext] App returned to foreground - requiring PIN re-entry');
        // Logout user to show PIN screen again
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false,
          appWentToBackground: false 
        }));
        // Trigger a refresh to ensure data is synced
        loadDataFromDatabase();
      }
    });
    
    return () => {
      cleanup();
      appStateSubscription.remove();
    };
  }, [loadDataFromDatabase]);

  useEffect(() => {
    loadDataFromDatabase();
  }, [loadDataFromDatabase]);

  const refreshData = useCallback(async () => {
    await loadDataFromDatabase();
  }, [loadDataFromDatabase]);

  const setAuthenticated = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isAuthenticated: value }));
  }, []);

  const setHasPin = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, hasPin: value }));
  }, []);

  const setTimeoutDisabled = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, timeoutDisabled: value }));
  }, []);

  const toggleTheme = useCallback(async () => {
    const newDarkMode = !state.isDarkMode;
    try {
      await database.updateAppSettings({ is_dark_mode: newDarkMode ? 1 : 0 });
      setState((prev) => ({ ...prev, isDarkMode: newDarkMode }));
    } catch (error) {
      console.error("Failed to persist theme setting:", error);
    }
  }, [state.isDarkMode]);

  const setDarkMode = useCallback(async (value: boolean) => {
    try {
      await database.updateAppSettings({ is_dark_mode: value ? 1 : 0 });
      setState((prev) => ({ ...prev, isDarkMode: value }));
    } catch (error) {
      console.error("Failed to persist theme setting:", error);
    }
  }, []);

  const generateQRCode = (id: number): string => {
    return `GYM-${id.toString().padStart(6, "0")}`;
  };

  const addMember = useCallback(
    async (
      memberData: Omit<Member, "id" | "qr_code" | "qr_image_path">
    ): Promise<Member> => {
      const tempId = Date.now();
      const id = await database.insertMember({
        ...memberData,
        qr_code: generateQRCode(tempId),
        qr_image_path: null,
      });

      const finalQRCode = generateQRCode(id);
      await database.updateMemberById(id, { qr_code: finalQRCode });

      const newMember: Member = {
        ...memberData,
        id,
        qr_code: finalQRCode,
        qr_image_path: "",
      };

      setState((prev) => ({
        ...prev,
        members: [newMember, ...prev.members],
      }));

      return newMember;
    },
    []
  );

  const updateMember = useCallback(async (id: number, updates: Partial<Member>) => {
    await database.updateMemberById(id, updates);
    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  }, []);

  const deleteMember = useCallback(async (id: number) => {
    await database.deleteMemberById(id);
    setState((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
    }));
  }, []);

  const getMember = useCallback(
    (id: number): Member | undefined => state.members.find((m) => m.id === id),
    [state.members]
  );

  const getMemberByQR = useCallback(
    (qrCode: string) => state.members.find((m) => m.qr_code === qrCode),
    [state.members]
  );

  const addAttendance = useCallback(async (memberId: number) => {
    const now = new Date();
    const attendanceData = {
      member_id: memberId,
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().split(" ")[0],
    };

    let id: number;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        id = await database.insertAttendance(attendanceData);
        console.log('[AppContext] Attendance recorded successfully:', { id, memberId, time: attendanceData.time });
        break;
      } catch (error) {
        retries++;
        console.warn(`[AppContext] Failed to record attendance (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries >= maxRetries) {
          console.error('[AppContext] CRITICAL: Failed to record attendance after retries', error);
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }

    setState((prev) => ({
      ...prev,
      attendance: [{ id, ...attendanceData }, ...prev.attendance],
    }));
  }, []);

  const addSale = useCallback(async (type: string, amount: number, note: string) => {
    const saleData = {
      type,
      amount,
      date: new Date().toISOString().split("T")[0],
      note,
    };

    let id: number;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        id = await database.insertSale(saleData);
        console.log('[AppContext] Sale inserted successfully:', { id, type, amount });
        break;
      } catch (error) {
        retries++;
        console.warn(`[AppContext] Failed to insert sale (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries >= maxRetries) {
          console.error('[AppContext] CRITICAL: Failed to insert sale after retries', error);
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }

    setState((prev) => ({
      ...prev,
      sales: [{ id, ...saleData }, ...prev.sales],
    }));
  }, []);

  const updatePriceSettings = useCallback(async (settings: Partial<PriceSettings>) => {
    await database.updatePriceSettingsDB(settings);
    setState((prev) => ({
      ...prev,
      priceSettings: { ...prev.priceSettings, ...settings },
    }));
  }, []);

  const getTodayAttendance = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return state.attendance.filter((a) => a.date === today);
  }, [state.attendance]);

  const getTodaySales = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return state.sales
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + s.amount, 0);
  }, [state.sales]);

  const getActiveMembers = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return state.members.filter(
      (m) => m.subscription_end && m.subscription_end >= today
    );
  }, [state.members]);

  const getExpiredMembers = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    return state.members.filter(
      (m) => !m.subscription_end || m.subscription_end < today
    );
  }, [state.members]);

  const renewSubscription = useCallback(
    async (memberId: number) => {
      const member = state.members.find((m) => m.id === memberId);
      if (!member) return;

      const today = new Date();
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 1);

      const priceKey =
        `${member.membership_type}_monthly` as keyof PriceSettings;
      const amount = state.priceSettings[priceKey];

      await updateMember(memberId, {
        subscription_start: today.toISOString().split("T")[0],
        subscription_end: endDate.toISOString().split("T")[0],
      });

      await addSale(
        `monthly_${member.membership_type}`,
        amount,
        `Monthly subscription for ${member.firstname} ${member.lastname}`
      );
    },
    [state.members, state.priceSettings, updateMember, addSale]
  );

  const paySession = useCallback(
    async (memberId: number, isMember: boolean, isSenior: boolean = false) => {
      const member = state.members.find((m) => m.id === memberId);

      let amount: number;
      let type: string;

      if (isMember) {
        amount = isSenior ? state.priceSettings.session_member_senior : state.priceSettings.session_member;
        type = isSenior ? "session_member_senior" : "session_member";
      } else {
        amount = isSenior ? state.priceSettings.session_nonmember_senior : state.priceSettings.session_nonmember;
        type = isSenior ? "session_nonmember_senior" : "session_nonmember";
      }

      const note = member
        ? `Session for ${member.firstname} ${member.lastname}${isSenior ? " (Senior)" : ""}`
        : `Walk-in session${isSenior ? " (Senior)" : ""}`;

      await addSale(type, amount, note);

      if (memberId > 0) {
        await addAttendance(memberId);
      }
    },
    [state.members, state.priceSettings, addSale, addAttendance]
  );

  const backupAllData = useCallback(async (): Promise<string> => {
    const backupData = {
      members: state.members,
      attendance: state.attendance,
      sales: state.sales,
      priceSettings: state.priceSettings,
      timestamp: new Date().toISOString(),
      version: "1.0",
    };
    return JSON.stringify(backupData);
  }, [state.members, state.attendance, state.sales, state.priceSettings]);

  const restoreFromBackup = useCallback(async (backupData: string): Promise<void> => {
    try {
      const parsed = JSON.parse(backupData);
      
      if (!parsed.members || !parsed.attendance || !parsed.sales || !parsed.priceSettings) {
        throw new Error("Invalid backup file - missing required data");
      }

      // FIRST: Clear all existing data
      console.log('[AppContext] Clearing existing data before restore...');
      try {
        await database.clearAllData();
      } catch (clearError) {
        console.warn('[AppContext] Error clearing data:', clearError);
        throw new Error('Failed to clear existing data');
      }

      // SECOND: Restore members
      console.log('[AppContext] Restoring members...');
      for (const member of parsed.members) {
        try {
          await database.insertMember(member);
        } catch (e) {
          console.warn('[AppContext] Failed to restore member:', member.id, e);
        }
      }

      // THIRD: Restore attendance
      console.log('[AppContext] Restoring attendance records...');
      for (const record of parsed.attendance) {
        try {
          await database.insertAttendance(record);
        } catch (e) {
          console.warn('[AppContext] Failed to restore attendance record:', record.id, e);
        }
      }

      // FOURTH: Restore sales
      console.log('[AppContext] Restoring sales records...');
      for (const sale of parsed.sales) {
        try {
          await database.insertSale(sale);
        } catch (e) {
          console.warn('[AppContext] Failed to restore sale:', sale.id, e);
        }
      }

      // FIFTH: Restore price settings
      console.log('[AppContext] Restoring price settings...');
      if (parsed.priceSettings) {
        await database.updatePriceSettingsDB(parsed.priceSettings);
      }

      console.log('[AppContext] Backup restored successfully');
      // Reload data from database
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit for DB operations
      await loadDataFromDatabase();
    } catch (error) {
      console.error("Failed to restore from backup:", error);
      throw error;
    }
  }, [loadDataFromDatabase]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setAuthenticated,
        setHasPin,
        toggleTheme,
        setDarkMode,
        timeoutDisabled: state.timeoutDisabled,
        setTimeoutDisabled, // NEW EXPORT
        setAppWentToBackground: (value: boolean) => setState(prev => ({ ...prev, appWentToBackground: value })),
        addMember,
        updateMember,
        deleteMember,
        getMember,
        getMemberByQR,
        addAttendance,
        addSale,
        updatePriceSettings,
        getTodayAttendance,
        getTodaySales,
        getActiveMembers,
        getExpiredMembers,
        renewSubscription,
        paySession,
        refreshData,
        backupAllData,
        restoreFromBackup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

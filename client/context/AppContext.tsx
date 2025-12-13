import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { Appearance, Platform } from "react-native";
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
}

interface AppContextType extends AppState {
  setAuthenticated: (value: boolean) => void;
  setHasPin: (value: boolean) => void;
  toggleTheme: () => void;
  setDarkMode: (value: boolean) => void;
  setTimeoutDisabled: (value: boolean) => void; // NEW
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
  paySession: (memberId: number, isMember: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

const defaultPriceSettings: PriceSettings = {
  id: 1,
  membership: 1500,
  student_monthly: 500,
  regular_monthly: 700,
  senior_monthly: 400,
  session_member: 50,
  session_nonmember: 80,
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

    const id = await database.insertAttendance(attendanceData);

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

    const id = await database.insertSale(saleData);

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
    async (memberId: number, isMember: boolean) => {
      const member = state.members.find((m) => m.id === memberId);

      const amount = isMember
        ? state.priceSettings.session_member
        : state.priceSettings.session_nonmember;

      const type = isMember ? "session_member" : "session_nonmember";

      const note = member
        ? `Session for ${member.firstname} ${member.lastname}`
        : "Walk-in session";

      await addSale(type, amount, note);

      if (memberId > 0) {
        await addAttendance(memberId);
      }
    },
    [state.members, state.priceSettings, addSale, addAttendance]
  );

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

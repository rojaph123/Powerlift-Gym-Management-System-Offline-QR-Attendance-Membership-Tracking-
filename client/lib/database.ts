import { Platform } from 'react-native';

const DB_NAME = 'powerlift_gym.db';

let db: any = null;

interface InMemoryDB {
  members: DBMember[];
  attendance: DBAttendance[];
  sales: DBSale[];
  priceSettings: DBPriceSettings;
  appSettings: DBAppSettings;
}

let inMemoryDB: InMemoryDB = {
  members: [],
  attendance: [],
  sales: [],
  priceSettings: {
    id: 1,
    membership: 1500,
    student_monthly: 500,
    regular_monthly: 700,
    senior_monthly: 400,
    session_member: 50,
    session_nonmember: 80,
  },
  appSettings: { id: 1, pin_hash: null, is_dark_mode: 1 },
};

async function getSQLiteDatabase() {
  if (Platform.OS === 'web') {
    console.log('[Database] Running on web - using in-memory storage (for testing only)');
    return null;
  }
  
  try {
    const SQLite = await import('expo-sqlite');
    if (!db) {
      console.log('[Database] Initializing SQLite database...');
      db = await SQLite.openDatabaseAsync(DB_NAME);
      await initDatabase(db);
      console.log('[Database] SQLite database initialized successfully');
    }
    return db;
  } catch (error) {
    console.error('[Database] CRITICAL: Failed to initialize SQLite database on native platform:', error);
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Data will not persist!`);
  }
}

async function initDatabase(database: any): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY,
      firstname TEXT NOT NULL,
      lastname TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      photo TEXT,
      qr_code TEXT NOT NULL,
      qr_image_path TEXT,
      membership_type TEXT NOT NULL,
      is_member INTEGER DEFAULT 1,
      subscription_start TEXT,
      subscription_end TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY,
      member_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS price_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      membership REAL DEFAULT 1500,
      student_monthly REAL DEFAULT 500,
      regular_monthly REAL DEFAULT 700,
      senior_monthly REAL DEFAULT 400,
      session_member REAL DEFAULT 50,
      session_nonmember REAL DEFAULT 80
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      pin_hash TEXT,
      is_dark_mode INTEGER DEFAULT 1
    );
  `);

  const priceSettings = await database.getFirstAsync('SELECT * FROM price_settings WHERE id = 1');
  if (!priceSettings) {
    await database.runAsync(
      'INSERT INTO price_settings (id, membership, student_monthly, regular_monthly, senior_monthly, session_member, session_nonmember) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [1, 1500, 500, 700, 400, 50, 80]
    );
  }

  const appSettings = await database.getFirstAsync('SELECT * FROM app_settings WHERE id = 1');
  if (!appSettings) {
    await database.runAsync(
      'INSERT INTO app_settings (id, is_dark_mode) VALUES (?, ?)',
      [1, 1]
    );
  }
}

export interface DBMember {
  id: number;
  firstname: string;
  lastname: string;
  age: number;
  gender: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  qr_code: string;
  qr_image_path: string | null;
  membership_type: string;
  is_member: number;
  subscription_start: string | null;
  subscription_end: string | null;
}

export interface DBAttendance {
  id: number;
  member_id: number;
  date: string;
  time: string;
}

export interface DBSale {
  id: number;
  type: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface DBPriceSettings {
  id: number;
  membership: number;
  student_monthly: number;
  regular_monthly: number;
  senior_monthly: number;
  session_member: number;
  session_nonmember: number;
}

export interface DBAppSettings {
  id: number;
  pin_hash: string | null;
  is_dark_mode: number;
}

export async function getAllMembers(): Promise<DBMember[]> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return [...inMemoryDB.members].sort((a, b) => b.id - a.id);
  }
  const rows = await database.getAllAsync('SELECT * FROM members ORDER BY id DESC');
return rows as DBMember[];

}

export async function getMemberById(id: number): Promise<DBMember | null> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return inMemoryDB.members.find(m => m.id === id) || null;
  }
  const row = await database.getFirstAsync('SELECT * FROM members WHERE id = ?', [id]);
return row as DBMember | null;

}

export async function getMemberByQRCode(qrCode: string): Promise<DBMember | null> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return inMemoryDB.members.find(m => m.qr_code === qrCode) || null;
  }
  const row = await database.getFirstAsync('SELECT * FROM members WHERE qr_code = ?', [qrCode]);
return row as DBMember | null;

}

export async function insertMember(member: Omit<DBMember, 'id'>): Promise<number> {
  const database = await getSQLiteDatabase();
  if (!database) {
    const id = Date.now();
    inMemoryDB.members.push({ ...member, id });
    return id;
  }
  
  const result = await database.runAsync(
    `INSERT INTO members (firstname, lastname, age, gender, email, phone, photo, qr_code, qr_image_path, membership_type, is_member, subscription_start, subscription_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      member.firstname,
      member.lastname,
      member.age,
      member.gender,
      member.email,
      member.phone,
      member.photo,
      member.qr_code,
      member.qr_image_path,
      member.membership_type,
      member.is_member,
      member.subscription_start,
      member.subscription_end
    ]
  );
  return result.lastInsertRowId;
}

export async function updateMemberById(id: number, updates: Partial<DBMember>): Promise<void> {
  const database = await getSQLiteDatabase();
  if (!database) {
    const index = inMemoryDB.members.findIndex(m => m.id === id);
    if (index !== -1) {
      inMemoryDB.members[index] = { ...inMemoryDB.members[index], ...updates };
    }
    return;
  }
  
  const keys = Object.keys(updates).filter(k => k !== 'id');
  if (keys.length === 0) return;

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (updates as Record<string, string | number | null>)[k]);
  values.push(id);

  await database.runAsync(`UPDATE members SET ${setClause} WHERE id = ?`, values);
}

export async function deleteMemberById(id: number): Promise<void> {
  const database = await getSQLiteDatabase();
  if (!database) {
    inMemoryDB.members = inMemoryDB.members.filter(m => m.id !== id);
    inMemoryDB.attendance = inMemoryDB.attendance.filter(a => a.member_id !== id);
    return;
  }
  
  await database.runAsync('DELETE FROM members WHERE id = ?', [id]);
  await database.runAsync('DELETE FROM attendance WHERE member_id = ?', [id]);
}

export async function getAllAttendance(): Promise<DBAttendance[]> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return [...inMemoryDB.attendance].sort((a, b) => b.id - a.id);
  }
  const rows = await database.getAllAsync('SELECT * FROM attendance ORDER BY id DESC');
return rows as DBAttendance[];

}

export async function insertAttendance(attendance: Omit<DBAttendance, 'id'>): Promise<number> {
  const database = await getSQLiteDatabase();
  if (!database) {
    const id = Date.now();
    inMemoryDB.attendance.push({ ...attendance, id });
    return id;
  }
  
  const result = await database.runAsync(
    'INSERT INTO attendance (member_id, date, time) VALUES (?, ?, ?)',
    [attendance.member_id, attendance.date, attendance.time]
  );
  return result.lastInsertRowId;
}

export async function getAllSales(): Promise<DBSale[]> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return [...inMemoryDB.sales].sort((a, b) => b.id - a.id);
  }
  const rows = await database.getAllAsync('SELECT * FROM sales ORDER BY id DESC');
return rows as DBSale[];

}

export async function insertSale(sale: Omit<DBSale, 'id'>): Promise<number> {
  const database = await getSQLiteDatabase();
  if (!database) {
    const id = Date.now();
    inMemoryDB.sales.push({ ...sale, id });
    return id;
  }
  
  const result = await database.runAsync(
    'INSERT INTO sales (type, amount, date, note) VALUES (?, ?, ?, ?)',
    [sale.type, sale.amount, sale.date, sale.note]
  );
  return result.lastInsertRowId;
}

export async function getPriceSettings(): Promise<DBPriceSettings> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return inMemoryDB.priceSettings;
  }
  
  const row = await database.getFirstAsync('SELECT * FROM price_settings WHERE id = 1');
const settings = row as DBPriceSettings | null;

  return settings || {
    id: 1,
    membership: 1500,
    student_monthly: 500,
    regular_monthly: 700,
    senior_monthly: 400,
    session_member: 50,
    session_nonmember: 80,
  };
}

export async function updatePriceSettingsDB(settings: Partial<DBPriceSettings>): Promise<void> {
  const database = await getSQLiteDatabase();
  if (!database) {
    inMemoryDB.priceSettings = { ...inMemoryDB.priceSettings, ...settings };
    return;
  }
  
  const keys = Object.keys(settings).filter(k => k !== 'id');
  if (keys.length === 0) return;

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (settings as Record<string, number>)[k]);

  await database.runAsync(`UPDATE price_settings SET ${setClause} WHERE id = 1`, values);
}

export async function getAppSettings(): Promise<DBAppSettings> {
  const database = await getSQLiteDatabase();
  if (!database) {
    return inMemoryDB.appSettings;
  }
  
 const row = await database.getFirstAsync('SELECT * FROM app_settings WHERE id = 1');
const settings = row as DBAppSettings | null;

  return settings || { id: 1, pin_hash: null, is_dark_mode: 1 };
}

export async function updateAppSettings(settings: Partial<DBAppSettings>): Promise<void> {
  const database = await getSQLiteDatabase();
  if (!database) {
    inMemoryDB.appSettings = { ...inMemoryDB.appSettings, ...settings };
    return;
  }
  
  const keys = Object.keys(settings).filter(k => k !== 'id');
  if (keys.length === 0) return;

  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (settings as Record<string, string | number | null>)[k]);

  await database.runAsync(`UPDATE app_settings SET ${setClause} WHERE id = 1`, values);
}

export async function hasPin(): Promise<boolean> {
  const settings = await getAppSettings();
  return !!settings.pin_hash;
}

export async function savePin(pin: string): Promise<void> {
  await updateAppSettings({ pin_hash: pin });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const settings = await getAppSettings();
  return settings.pin_hash === pin;
}


import { User, UserRole, TimetableEntry, ClassSession, AttendanceRecord } from '../types';

// Mock Data Keys - In a real app, these would be Firebase Collections
const USERS_KEY = 'smart_attendance_users';
const TIMETABLE_KEY = 'smart_attendance_timetable';
const SESSIONS_KEY = 'smart_attendance_sessions';
const ATTENDANCE_KEY = 'smart_attendance_attendance';

const getFromStorage = <T,>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveToStorage = <T,>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const storageService = {
  // User Methods
  saveUser: (user: User) => {
    const users = getFromStorage<User>(USERS_KEY);
    users.push(user);
    saveToStorage(USERS_KEY, users);
  },
  
  updateUser: (updatedUser: User) => {
    const users = getFromStorage<User>(USERS_KEY);
    const index = users.findIndex(u => u.uid === updatedUser.uid);
    if (index !== -1) {
      users[index] = updatedUser;
      saveToStorage(USERS_KEY, users);
    }
  },

  deleteUser: (uid: string) => {
    let users = getFromStorage<User>(USERS_KEY);
    users = users.filter(u => u.uid !== uid);
    saveToStorage(USERS_KEY, users);
  },
  
  findUser: (email: string, role: UserRole, password?: string): User | undefined => {
    const users = getFromStorage<User>(USERS_KEY);
    // If password is provided, check it. If not (legacy/mock), just check email/role
    if (password) {
      return users.find(u => u.email === email && u.role === role && u.password === password);
    }
    return users.find(u => u.email === email && u.role === role);
  },

  authenticateUser: (email: string, password?: string): User | undefined => {
    const users = getFromStorage<User>(USERS_KEY);
    if (password) {
      return users.find(u => u.email === email && u.password === password);
    }
    return users.find(u => u.email === email);
  },

  getAllUsers: (): User[] => {
    return getFromStorage<User>(USERS_KEY);
  },

  // Timetable Methods
  getTimetable: (facultyId: string): TimetableEntry[] => {
    const all = getFromStorage<TimetableEntry>(TIMETABLE_KEY);
    return all.filter(t => t.facultyId === facultyId);
  },

  getAllTimetables: (): TimetableEntry[] => {
    return getFromStorage<TimetableEntry>(TIMETABLE_KEY);
  },

  addTimetableEntry: (entry: TimetableEntry) => {
    const all = getFromStorage<TimetableEntry>(TIMETABLE_KEY);
    all.push(entry);
    saveToStorage(TIMETABLE_KEY, all);
  },

  deleteTimetableEntry: (id: string) => {
    let all = getFromStorage<TimetableEntry>(TIMETABLE_KEY);
    all = all.filter(t => t.id !== id);
    saveToStorage(TIMETABLE_KEY, all);
  },

  // Session Methods
  createSession: (session: ClassSession) => {
    const all = getFromStorage<ClassSession>(SESSIONS_KEY);
    // Deactivate other sessions for this faculty
    const updated = all.map(s => s.facultyId === session.facultyId ? { ...s, isActive: false, endTime: Date.now() } : s);
    updated.push(session);
    saveToStorage(SESSIONS_KEY, updated);
  },

  getActiveSession: (facultyId: string): ClassSession | undefined => {
    const all = getFromStorage<ClassSession>(SESSIONS_KEY);
    return all.find(s => s.facultyId === facultyId && s.isActive);
  },

  getSessionById: (sessionId: string): ClassSession | undefined => {
    const all = getFromStorage<ClassSession>(SESSIONS_KEY);
    return all.find(s => s.id === sessionId);
  },

  getAllSessions: (): ClassSession[] => {
    return getFromStorage<ClassSession>(SESSIONS_KEY);
  },

  endSession: (sessionId: string) => {
    const all = getFromStorage<ClassSession>(SESSIONS_KEY);
    const updated = all.map(s => s.id === sessionId ? { ...s, isActive: false, endTime: Date.now() } : s);
    saveToStorage(SESSIONS_KEY, updated);
  },

  updateSessionQR: (sessionId: string, qrCode: string, token: string, timestamp: number) => {
    const all = getFromStorage<ClassSession>(SESSIONS_KEY);
    const updated = all.map(s => s.id === sessionId ? { 
      ...s, 
      currentQRCode: qrCode,
      lastQrToken: token,
      lastQrTimestamp: timestamp
    } : s);
    saveToStorage(SESSIONS_KEY, updated);
  },

  // Secure Validation
  validateQR: (qrContent: string): { valid: boolean; sessionId?: string; error?: string } => {
    try {
      // Expected format: "SECURE:sessionId:timestamp:token"
      const parts = qrContent.split(':');
      if (parts.length !== 4 || parts[0] !== 'SECURE') {
        return { valid: false, error: 'Invalid QR Code format' };
      }

      const [_, sessionId, timestampStr, token] = parts;
      const timestamp = parseInt(timestampStr);
      
      const allSessions = getFromStorage<ClassSession>(SESSIONS_KEY);
      const session = allSessions.find(s => s.id === sessionId);

      if (!session) {
        return { valid: false, error: 'Session not found' };
      }

      if (!session.isActive) {
        return { valid: false, error: 'Session has ended' };
      }

      // 1. Check Token Match (Prevents using old generated codes from the same session)
      if (session.lastQrToken !== token) {
        return { valid: false, error: 'QR Code expired (Token mismatch)' };
      }

      // 2. Check Timestamp (Prevents replay of a screenshot if delay is too long)
      // Allow 20 seconds window (10s life + 10s buffer for scanning/latency)
      const now = Date.now();
      const timeDiff = now - timestamp;
      
      if (timeDiff > 20000) {
        return { valid: false, error: 'QR Code expired (Timeout)' };
      }

      return { valid: true, sessionId: session.id };

    } catch (e) {
      return { valid: false, error: 'Failed to parse QR code' };
    }
  },

  // Attendance Methods
  markAttendance: (record: AttendanceRecord) => {
    const all = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY);
    // Check if already present
    const exists = all.find(r => r.sessionId === record.sessionId && r.studentId === record.studentId);
    if (!exists) {
      all.push(record);
      saveToStorage(ATTENDANCE_KEY, all);
      return true;
    }
    return false;
  },

  deleteAttendance: (id: string) => {
    let all = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY);
    all = all.filter(r => r.id !== id);
    saveToStorage(ATTENDANCE_KEY, all);
  },

  getAttendanceForStudent: (studentId: string): AttendanceRecord[] => {
    const all = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY);
    return all.filter(r => r.studentId === studentId).sort((a, b) => b.timestamp - a.timestamp);
  },

  getAttendanceForSession: (sessionId: string): AttendanceRecord[] => {
    const all = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY);
    return all.filter(r => r.sessionId === sessionId);
  },

  getAllAttendance: (): AttendanceRecord[] => {
    const all = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY);
    return all.sort((a, b) => b.timestamp - a.timestamp);
  },
  
  getGlobalStats: () => {
    const users = getFromStorage<User>(USERS_KEY);
    const sessions = getFromStorage<ClassSession>(SESSIONS_KEY);
    const attendance = getFromStorage<AttendanceRecord>(ATTENDANCE_KEY);
    
    return {
      totalStudents: users.filter(u => u.role === UserRole.STUDENT).length,
      totalFaculty: users.filter(u => u.role === UserRole.FACULTY).length,
      totalSessions: sessions.length,
      totalAttendance: attendance.length
    };
  }
};

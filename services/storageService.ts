
import { User, UserRole, TimetableEntry, ClassSession, AttendanceRecord } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  orderBy
} from 'firebase/firestore';

// Collection names
const USERS_COLLECTION = 'users';
const TIMETABLE_COLLECTION = 'timetable';
const SESSIONS_COLLECTION = 'sessions';
const ATTENDANCE_COLLECTION = 'attendance';

// Helper to remove undefined fields as Firestore doesn't support them
const sanitizeData = (data: any) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) { // Also handle null if needed, but Firestore supports null
      acc[key] = value;
    }
    return acc;
  }, {} as any);
};

export const storageService = {
  // User Methods
  saveUser: async (user: User) => {
    try {
      const userRef = doc(db, USERS_COLLECTION, user.uid);
      // Sanitize data to remove undefined fields
      const userData = sanitizeData(user);
      
      // Using Date.now() instead of Timestamp to avoid serialization issues
      await setDoc(userRef, {
        ...userData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      console.log('User saved to Firebase:', user.email);
    } catch (error: any) {
      console.error('Error saving user:', error);
      // Throwing specific error to be caught by UI
      throw new Error(error.message || "Failed to save user data");
    }
  },
  
  updateUser: async (updatedUser: User) => {
    try {
      const userRef = doc(db, USERS_COLLECTION, updatedUser.uid);
      const userData = sanitizeData(updatedUser);

      await updateDoc(userRef, {
        ...userData,
        updatedAt: Date.now()
      });
      console.log('User updated in Firebase');
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  deleteUser: async (uid: string) => {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await deleteDoc(userRef);
      console.log('User deleted from Firebase');
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },
  
  findUser: async (email: string, role: UserRole, password?: string): Promise<User | undefined> => {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      // Note: Composite queries (email + role) require an index. 
      // If index is missing, this might fail. 
      // Fallback: Query by email only, then filter in memory.
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return undefined;
      
      // Filter in memory to match role and password
      const userData = querySnapshot.docs[0].data() as User;
      
      if (userData.role !== role) return undefined;
      
      if (password && userData.password !== password) {
        return undefined;
      }
      
      return userData;
    } catch (error) {
      console.error('Error finding user:', error);
      return undefined;
    }
  },

  authenticateUser: async (email: string, password?: string): Promise<User | undefined> => {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('No user found with email:', email);
        return undefined;
      }
      
      const userData = querySnapshot.docs[0].data() as User;
      
      if (password && userData.password !== password) {
        console.log('Password mismatch');
        return undefined;
      }
      
      console.log('User authenticated:', userData.email);
      return userData;
    } catch (error) {
      console.error('Error authenticating user:', error);
      return undefined;
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const querySnapshot = await getDocs(usersRef);
      return querySnapshot.docs.map(doc => doc.data() as User);
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  },

  // Timetable Methods
  getTimetable: async (facultyId: string): Promise<TimetableEntry[]> => {
    try {
      const timetableRef = collection(db, TIMETABLE_COLLECTION);
      const q = query(timetableRef, where('facultyId', '==', facultyId));
      const querySnapshot = await getDocs(q);
      // Ensure doc.id is used as the entry id to enable correct deletion
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimetableEntry));
    } catch (error) {
      console.error('Error getting timetable:', error);
      return [];
    }
  },

  getAllTimetables: async (): Promise<TimetableEntry[]> => {
    try {
      const timetableRef = collection(db, TIMETABLE_COLLECTION);
      const querySnapshot = await getDocs(timetableRef);
      // Ensure doc.id is used as the entry id
      return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TimetableEntry));
    } catch (error) {
      console.error('Error getting all timetables:', error);
      return [];
    }
  },

  addTimetableEntry: async (entry: TimetableEntry) => {
    try {
      // Use setDoc with entry.id to ensure consistency between Document ID and data ID
      const entryRef = doc(db, TIMETABLE_COLLECTION, entry.id);
      await setDoc(entryRef, {
        ...entry,
        createdAt: Date.now()
      });
      console.log('Timetable entry added');
    } catch (error) {
      console.error('Error adding timetable entry:', error);
      throw error;
    }
  },

  deleteTimetableEntry: async (id: string) => {
    try {
      const entryRef = doc(db, TIMETABLE_COLLECTION, id);
      await deleteDoc(entryRef);
      console.log('Timetable entry deleted');
    } catch (error) {
      console.error('Error deleting timetable entry:', error);
      throw error;
    }
  },

  // Session Methods
  createSession: async (session: ClassSession) => {
    try {
      // First, deactivate other sessions for this faculty
      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsRef, where('facultyId', '==', session.facultyId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(docSnap => 
        updateDoc(doc(db, SESSIONS_COLLECTION, docSnap.id), {
          isActive: false,
          endTime: Date.now()
        })
      );
      
      await Promise.all(updatePromises);
      
      // Now create the new session
      const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
      await setDoc(sessionRef, {
        ...session,
        createdAt: Date.now()
      });
      
      console.log('Session created');
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  getActiveSession: async (facultyId: string): Promise<ClassSession | undefined> => {
    try {
      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsRef, where('facultyId', '==', facultyId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return undefined;
      
      return querySnapshot.docs[0].data() as ClassSession;
    } catch (error) {
      console.error('Error getting active session:', error);
      return undefined;
    }
  },

  getSessionById: async (sessionId: string): Promise<ClassSession | undefined> => {
    try {
      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsRef, where('id', '==', sessionId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return undefined;
      
      return querySnapshot.docs[0].data() as ClassSession;
    } catch (error) {
      console.error('Error getting session by ID:', error);
      return undefined;
    }
  },

  getAllSessions: async (): Promise<ClassSession[]> => {
    try {
      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      const querySnapshot = await getDocs(sessionsRef);
      return querySnapshot.docs.map(doc => doc.data() as ClassSession);
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  },

  endSession: async (sessionId: string) => {
    try {
      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsRef, where('id', '==', sessionId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const sessionDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, SESSIONS_COLLECTION, sessionDoc.id), {
          isActive: false,
          endTime: Date.now()
        });
        console.log('Session ended');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  },

  updateSessionQR: async (sessionId: string, qrCode: string, token: string, timestamp: number) => {
    try {
      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsRef, where('id', '==', sessionId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const sessionDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, SESSIONS_COLLECTION, sessionDoc.id), {
          currentQRCode: qrCode,
          lastQrToken: token,
          lastQrTimestamp: timestamp
        });
      }
    } catch (error) {
      console.error('Error updating session QR:', error);
      throw error;
    }
  },

  // Secure Validation
  validateQR: async (qrContent: string): Promise<{ valid: boolean; sessionId?: string; error?: string }> => {
    try {
      const parts = qrContent.split(':');
      if (parts.length !== 4 || parts[0] !== 'SECURE') {
        return { valid: false, error: 'Invalid QR Code format' };
      }

      const [_, sessionId, timestampStr, token] = parts;
      const timestamp = parseInt(timestampStr);
      
      const session = await storageService.getSessionById(sessionId);

      if (!session) {
        return { valid: false, error: 'Session not found' };
      }

      if (!session.isActive) {
        return { valid: false, error: 'Session has ended' };
      }

      if (session.lastQrToken !== token) {
        return { valid: false, error: 'QR Code expired (Token mismatch)' };
      }

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
  markAttendance: async (record: AttendanceRecord): Promise<boolean> => {
    try {
      const attendanceRef = collection(db, ATTENDANCE_COLLECTION);
      const q = query(
        attendanceRef, 
        where('sessionId', '==', record.sessionId),
        where('studentId', '==', record.studentId)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        console.log('Attendance already marked');
        return false;
      }
      
      await addDoc(attendanceRef, {
        ...record,
        createdAt: Date.now()
      });
      
      console.log('Attendance marked');
      return true;
    } catch (error) {
      console.error('Error marking attendance:', error);
      return false;
    }
  },

  deleteAttendance: async (id: string) => {
    try {
      const attendanceRef = collection(db, ATTENDANCE_COLLECTION);
      const q = query(attendanceRef, where('id', '==', id));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const attendanceDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, ATTENDANCE_COLLECTION, attendanceDoc.id));
        console.log('Attendance deleted');
      }
    } catch (error) {
      console.error('Error deleting attendance:', error);
      throw error;
    }
  },

  getAttendanceForStudent: async (studentId: string): Promise<AttendanceRecord[]> => {
    try {
      const attendanceRef = collection(db, ATTENDANCE_COLLECTION);
      // Note: Removed orderBy('timestamp') to avoid composite index requirement error
      const q = query(attendanceRef, where('studentId', '==', studentId));
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => doc.data() as AttendanceRecord);
      
      // Sort in-memory instead
      return records.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting student attendance:', error);
      return [];
    }
  },

  getAttendanceForSession: async (sessionId: string): Promise<AttendanceRecord[]> => {
    try {
      const attendanceRef = collection(db, ATTENDANCE_COLLECTION);
      const q = query(attendanceRef, where('sessionId', '==', sessionId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as AttendanceRecord);
    } catch (error) {
      console.error('Error getting session attendance:', error);
      return [];
    }
  },

  getAllAttendance: async (): Promise<AttendanceRecord[]> => {
    try {
      const attendanceRef = collection(db, ATTENDANCE_COLLECTION);
      const q = query(attendanceRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as AttendanceRecord);
    } catch (error) {
      console.error('Error getting all attendance:', error);
      return [];
    }
  },
  
  getGlobalStats: async () => {
    try {
      const users = await storageService.getAllUsers();
      const sessions = await storageService.getAllSessions();
      const attendance = await storageService.getAllAttendance();
      
      return {
        totalStudents: users.filter(u => u.role === UserRole.STUDENT).length,
        totalFaculty: users.filter(u => u.role === UserRole.FACULTY).length,
        totalSessions: sessions.length,
        totalAttendance: attendance.length
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return {
        totalStudents: 0,
        totalFaculty: 0,
        totalSessions: 0,
        totalAttendance: 0
      };
    }
  }
};

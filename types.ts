
export enum UserRole {
  STUDENT = 'student',
  FACULTY = 'faculty',
  ADMIN = 'admin',
}

export interface User {
  uid: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  department?: string; // Added department field
  subject?: string;    // Added subject field (for Faculty)
  faceDataUrl?: string; // Mocking face ID storage
  rollNo?: string;     // Added roll number for students
}

export interface TimetableEntry {
  id: string;
  facultyId: string;
  subject: string;
  day: string; // Mon, Tue, etc.
  startTime: string;
  endTime: string;
}

export interface ClassSession {
  id: string;
  facultyId: string;
  subject: string;
  startTime: number;
  endTime: number | null;
  isActive: boolean;
  location: {
    lat: number;
    lng: number;
  };
  currentQRCode: string;
  lastQrToken?: string;     // For security validation
  lastQrTimestamp?: number; // For expiry validation
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  subject: string;
  timestamp: number;
  status: 'present' | 'absent';
  verifiedByFace: boolean;
  verifiedByLocation: boolean;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}
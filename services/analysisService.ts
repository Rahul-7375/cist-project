
import { User, ClassSession, AttendanceRecord, UserRole, AttendanceAlert } from '../types';
import { SUBJECTS_BY_DEPT } from '../utils/constants';

export const analysisService = {
  generateAlerts: (
    users: User[],
    sessions: ClassSession[],
    attendance: AttendanceRecord[],
    thresholdWarning = 75,
    thresholdCritical = 60
  ): AttendanceAlert[] => {
    const alerts: AttendanceAlert[] = [];
    const now = Date.now();
    
    // Only consider past sessions or started sessions
    const validSessions = sessions.filter(s => s.startTime < now);
    
    const students = users.filter(u => u.role === UserRole.STUDENT);

    students.forEach(student => {
      // Determine valid subjects for this student
      const studentSubjects = student.department 
        ? SUBJECTS_BY_DEPT[student.department] || [] 
        : [];

      // If student has no department/subjects, skipping specific logic or falling back to all
      // For accuracy, we filter sessions that match the student's department subjects
      const relevantSessions = validSessions.filter(s => 
        studentSubjects.length > 0 ? studentSubjects.includes(s.subject) : true
      );

      if (relevantSessions.length === 0) return;

      // Calculate Attendance
      const attendedCount = attendance.filter(r => 
        r.studentId === student.uid && 
        r.status === 'present' &&
        relevantSessions.some(s => s.id === r.sessionId) // Ensure record belongs to a relevant session
      ).length;

      const totalSessions = relevantSessions.length;
      const percentage = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

      if (percentage < thresholdWarning) {
        const isCritical = percentage < thresholdCritical;
        const missed = totalSessions - attendedCount;
        
        alerts.push({
          id: `alert-${student.uid}-${now}`,
          studentId: student.uid,
          studentName: student.name,
          rollNo: student.rollNo,
          department: student.department,
          type: isCritical ? 'critical' : 'warning',
          message: isCritical 
            ? `Critical: Attendance at ${percentage}% (${missed} missed)`
            : `Warning: Low attendance ${percentage}% (${missed} missed)`,
          attendancePercentage: percentage,
          missedSessions: missed,
          totalSessions: totalSessions
        });
      }
    });

    // Sort: Critical first, then by lowest percentage
    return alerts.sort((a, b) => {
      if (a.type === 'critical' && b.type !== 'critical') return -1;
      if (b.type === 'critical' && a.type !== 'critical') return 1;
      return a.attendancePercentage - b.attendancePercentage;
    });
  }
};

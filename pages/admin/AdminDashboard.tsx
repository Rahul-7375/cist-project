
import React, { useEffect, useState } from 'react';
import { storageService } from '../../services/storageService';
import { AttendanceRecord, User, UserRole, ClassSession } from '../../types';
import { Download, Users, FileText, CheckSquare, Search, Trash2, Edit, Save, X, Briefcase, BookOpen, BarChart3, Calendar, Filter, AlertTriangle, Hash } from 'lucide-react';
import Button from '../../components/Button';

const DEPARTMENTS = [
  "Computer Science and Engineering",
  "CSE-DS",
  "CSE-AIML",
  "Civil Engineering",
  "Electronics and Communications Engineering",
  "Mechanical Engineering"
];

const SUBJECTS_BY_DEPT: Record<string, string[]> = {
  "Computer Science and Engineering": ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"],
  "CSE-DS": ["ATCD", "PA", "WSMA", "NLP", "WSMA-LAB", "PA-LAB", "I&EE"],
  "CSE-AIML": ["Artificial Intelligence", "Deep Learning", "Neural Networks", "Natural Language Processing", "Computer Vision"],
  "Civil Engineering": ["Structural Analysis", "Geotechnical Engineering", "Surveying", "Construction Mgmt"],
  "Electronics and Communications Engineering": ["Digital Electronics", "Signals & Systems", "Microprocessors", "VLSI Design", "Communication Systems"],
  "Mechanical Engineering": ["Thermodynamics", "Fluid Mechanics", "Strength of Materials", "Machine Design"]
};

interface StudentReport {
  student: User;
  totalSessions: number;
  totalPresent: number;
  overallPercentage: number;
  subjectBreakdown: Record<string, { total: number; present: number; percentage: number }>;
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'users' | 'reports'>('overview');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalFaculty: 0, totalSessions: 0, totalAttendance: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state for manual entry
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualSubject, setManualSubject] = useState('');

  // Report Filter State
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportDept, setReportDept] = useState('');
  const [generatedReports, setGeneratedReports] = useState<StudentReport[]>([]);

  useEffect(() => {
    refreshData();
    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setReportEndDate(end.toISOString().split('T')[0]);
    setReportStartDate(start.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      generateReports();
    }
  }, [reportStartDate, reportEndDate, reportDept, users, records, sessions]);

  const refreshData = async () => {
    const [allRecords, allUsers, allSessions, globalStats] = await Promise.all([
      storageService.getAllAttendance(),
      storageService.getAllUsers(),
      storageService.getAllSessions(),
      storageService.getGlobalStats()
    ]);

    setRecords(allRecords);
    setUsers(allUsers);
    setSessions(allSessions);
    setStats(globalStats);
  };

  const generateReports = () => {
    if (!reportStartDate || !reportEndDate) return;

    const start = new Date(reportStartDate).getTime();
    const end = new Date(reportEndDate).getTime() + 86400000; // End of day

    // 1. Filter Sessions by Date and Department (if applicable)
    // Note: In a real app, we'd link sessions to departments more explicitly. 
    // Here we infer relevant sessions based on the department filter or include all.
    const relevantSessions = sessions.filter(s => {
      const matchesDate = s.startTime >= start && s.startTime <= end;
      // If a department is selected, we should strictly only count sessions that belong to that department's subjects
      // However, for simplicity in this mock, if a Dept is selected, we only filter Students by that dept.
      // The sessions are counted per subject later.
      return matchesDate;
    });

    // 2. Filter Students
    const targetStudents = users.filter(u => 
      u.role === UserRole.STUDENT && 
      (!reportDept || u.department === reportDept)
    );

    // 3. Build Report
    const reports: StudentReport[] = targetStudents.map(student => {
      // Determine sessions relevant to this student (based on their department subjects ideally, 
      // but here we'll assume all sessions are relevant or match by subject name if structured)
      
      // Better Logic: A student is expected to attend sessions that match their department subjects
      // If department is not set on student, assume all sessions are relevant (simplified)
      const studentSubjects = student.department ? SUBJECTS_BY_DEPT[student.department] || [] : [];
      
      const studentRelevantSessions = relevantSessions.filter(s => 
        !student.department || studentSubjects.includes(s.subject)
      );

      const subjectStats: Record<string, { total: number; present: number; percentage: number }> = {};
      let totalPresent = 0;

      // Initialize subjects
      studentRelevantSessions.forEach(s => {
        if (!subjectStats[s.subject]) {
          subjectStats[s.subject] = { total: 0, present: 0, percentage: 0 };
        }
        subjectStats[s.subject].total += 1;
      });

      // Count attendance
      records.forEach(r => {
        if (r.studentId === student.uid && r.timestamp >= start && r.timestamp <= end) {
          // Check if this attendance corresponds to a relevant session
          // (In a real DB we match by session ID. Here we do the same)
          const session = studentRelevantSessions.find(s => s.id === r.sessionId);
          if (session) {
            totalPresent++;
            if (subjectStats[r.subject]) {
              subjectStats[r.subject].present += 1;
            }
          }
        }
      });

      // Calculate percentages
      Object.keys(subjectStats).forEach(subj => {
        const data = subjectStats[subj];
        data.percentage = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
      });

      const totalSessionsCount = studentRelevantSessions.length;
      const overallPercentage = totalSessionsCount > 0 
        ? Math.round((totalPresent / totalSessionsCount) * 100) 
        : 0;

      return {
        student,
        totalSessions: totalSessionsCount,
        totalPresent,
        overallPercentage,
        subjectBreakdown: subjectStats
      };
    });

    // Sort by lowest attendance first for visibility
    setGeneratedReports(reports.sort((a, b) => a.overallPercentage - b.overallPercentage));
  };

  const handleManualAttendance = async () => {
    if (!manualStudentId || !manualSubject) return;

    const student = users.find(u => u.uid === manualStudentId);
    if (!student) return;

    const record: AttendanceRecord = {
      id: Date.now().toString(),
      sessionId: 'manual-' + Date.now(),
      studentId: student.uid,
      studentName: student.name,
      subject: manualSubject,
      timestamp: Date.now(),
      status: 'present',
      verifiedByFace: false,
      verifiedByLocation: false
    };

    await storageService.markAttendance(record);
    setManualSubject('');
    setManualStudentId('');
    await refreshData();
    alert('Attendance marked manually.');
  };

  const handleDeleteAttendance = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      await storageService.deleteAttendance(id);
      await refreshData();
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      await storageService.deleteUser(uid);
      await refreshData();
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await storageService.updateUser(editingUser);
      setEditingUser(null);
      await refreshData();
    }
  };

  const exportData = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
      JSON.stringify(records)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "attendance_data.json";
    link.click();
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.rollNo && u.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 relative">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg text-blue-600 dark:text-blue-400">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Students</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalStudents}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Faculty</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalFaculty}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-lg text-green-600 dark:text-green-400">
              <CheckSquare size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Attendance Recs</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalAttendance}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 dark:bg-orange-900/50 p-3 rounded-lg text-orange-600 dark:text-orange-400">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sessions</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalSessions}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg max-w-2xl transition-colors duration-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'overview' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50'
          }`}
        >
          Recent Activity
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'attendance' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50'
          }`}
        >
          Manage Attendance
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'users' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            activeTab === 'reports' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50'
          }`}
        >
          Reports
        </button>
      </div>

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Check-ins</h3>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="mr-2 w-4 h-4" /> Export JSON
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">{new Date(record.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{record.studentName}</td>
                    <td className="px-6 py-4">{record.subject}</td>
                    <td className="px-6 py-4">
                       <div className="flex gap-2">
                         {record.verifiedByFace && <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-900/50">Face</span>}
                         {record.verifiedByLocation && <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-1 rounded border border-purple-100 dark:border-purple-900/50">GPS</span>}
                         {!record.verifiedByFace && !record.verifiedByLocation && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">Manual</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">Present</span>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Attendance Management */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Manual Entry</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Student</label>
                    <select 
                      className="w-full border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2 border"
                      value={manualStudentId}
                      onChange={(e) => setManualStudentId(e.target.value)}
                    >
                      <option value="">-- Select Student --</option>
                      {users.filter(u => u.role === UserRole.STUDENT).map(u => (
                        <option key={u.uid} value={u.uid}>{u.name} ({u.rollNo || u.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject / Session</label>
                    <input 
                      type="text" 
                      className="w-full border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="e.g. CS101 Lecture"
                      value={manualSubject}
                      onChange={(e) => setManualSubject(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleManualAttendance} disabled={!manualStudentId || !manualSubject} className="w-full">
                    Mark Present
                  </Button>
                </div>
             </div>
          </div>
          
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700">
               <h3 className="text-lg font-bold text-slate-800 dark:text-white">Full Attendance Log</h3>
             </div>
             <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
               <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                 <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 uppercase text-xs sticky top-0 z-10">
                   <tr>
                     <th className="px-6 py-3 bg-slate-50 dark:bg-slate-800">Date</th>
                     <th className="px-6 py-3 bg-slate-50 dark:bg-slate-800">Student</th>
                     <th className="px-6 py-3 bg-slate-50 dark:bg-slate-800">Subject</th>
                     <th className="px-6 py-3 bg-slate-50 dark:bg-slate-800">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 group transition-colors">
                        <td className="px-6 py-3">{new Date(record.timestamp).toLocaleDateString()} {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{record.studentName}</td>
                        <td className="px-6 py-3">{record.subject}</td>
                        <td className="px-6 py-3">
                           <button 
                             onClick={() => handleDeleteAttendance(record.id)}
                             className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                             title="Delete Record"
                           >
                             <Trash2 size={16} />
                           </button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* Tab Content: Users */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
           <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
             <h3 className="text-lg font-bold text-slate-800 dark:text-white">Registered Users</h3>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
               <input 
                 type="text" 
                 placeholder="Search users..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors" 
               />
             </div>
           </div>
           <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
             <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 uppercase text-xs">
               <tr>
                 <th className="px-6 py-3">User Details</th>
                 <th className="px-6 py-3">Role</th>
                 <th className="px-6 py-3">Department</th>
                 <th className="px-6 py-3">Face ID</th>
                 <th className="px-6 py-3 text-right">Actions</th>
               </tr>
             </thead>
             <tbody>
               {filteredUsers.map(user => (
                 <tr key={user.uid} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                         {user.name.charAt(0)}
                       </div>
                       <div>
                         <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                         <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                         {user.rollNo && <div className="text-xs text-indigo-500 dark:text-indigo-400 font-mono">{user.rollNo}</div>}
                       </div>
                     </div>
                   </td>
                   <td className="px-6 py-4">
                     <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                       user.role === UserRole.ADMIN ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                       user.role === UserRole.FACULTY ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                       'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                     }`}>
                       {user.role}
                     </span>
                   </td>
                   <td className="px-6 py-4">
                     <div className="flex flex-col">
                       <span className="text-slate-700 dark:text-slate-300">{user.department || '-'}</span>
                       {user.subject && <span className="text-xs text-slate-500 dark:text-slate-400">{user.subject}</span>}
                     </div>
                   </td>
                   <td className="px-6 py-4">
                     {user.faceDataUrl ? (
                       <span className="flex items-center text-green-600 dark:text-green-400 text-xs font-medium"><CheckSquare className="w-3 h-3 mr-1"/> Registered</span>
                     ) : (
                       <span className="text-slate-400 dark:text-slate-500 text-xs">Not set</span>
                     )}
                   </td>
                   <td className="px-6 py-4 text-right">
                     <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={() => setEditingUser(user)}
                         className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                         title="Edit User"
                       >
                         <Edit size={16} />
                       </button>
                       {user.role !== UserRole.ADMIN && (
                         <button 
                           onClick={() => handleDeleteUser(user.uid)}
                           className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                           title="Delete User"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      )}

      {/* Tab Content: Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-200">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Filter size={20} className="text-indigo-500" /> Filter Report
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    value={reportDept}
                    onChange={(e) => setReportDept(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white appearance-none"
                  >
                    <option value="">All Departments</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Report Summary Cards */}
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-lg text-indigo-600 dark:text-indigo-400">
                   <BarChart3 size={24} />
                </div>
                <div>
                   <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Attendance</p>
                   <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                     {generatedReports.length > 0 
                       ? Math.round(generatedReports.reduce((acc, curr) => acc + curr.overallPercentage, 0) / generatedReports.length) 
                       : 0}%
                   </h3>
                </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-lg text-red-600 dark:text-red-400">
                   <AlertTriangle size={24} />
                </div>
                <div>
                   <p className="text-sm text-slate-500 dark:text-slate-400">Low Attendance</p>
                   <h3 className="text-2xl font-bold text-slate-800 dark:text-white">
                     {generatedReports.filter(r => r.overallPercentage < 75).length} Students
                   </h3>
                   <p className="text-xs text-red-500 dark:text-red-400">Below 75% threshold</p>
                </div>
             </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Detailed Student Reports</h3>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                 Showing {generatedReports.length} records
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Overall Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedReports.map((report, idx) => (
                    <tr key={report.student.uid} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {report.student.name}
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">{report.student.email}</div>
                        {report.student.rollNo && <div className="text-xs text-indigo-500 dark:text-indigo-400 font-mono">{report.student.rollNo}</div>}
                      </td>
                      <td className="px-6 py-4">{report.student.department || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                report.overallPercentage < 75 ? 'bg-red-500' : 
                                report.overallPercentage < 85 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${report.overallPercentage}%` }}
                            ></div>
                          </div>
                          <span className={`font-bold ${
                            report.overallPercentage < 75 ? 'text-red-600 dark:text-red-400' : 
                            report.overallPercentage < 85 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                          }`}>
                            {report.overallPercentage}%
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {report.totalPresent} / {report.totalSessions} Sessions
                        </div>
                      </td>
                    </tr>
                  ))}
                  {generatedReports.length === 0 && (
                    <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">No reports generated. Adjust filters to see data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden transition-colors duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/30">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit User Details</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  required
                />
              </div>

              {editingUser.role === UserRole.STUDENT && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Roll Number</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Hash className="h-4 w-4 text-slate-400" />
                     </div>
                     <input
                        type="text"
                        value={editingUser.rollNo || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, rollNo: e.target.value })}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white uppercase"
                        placeholder="e.g. 21XX1A05XX"
                     />
                  </div>
                </div>
              )}

              {(editingUser.role === UserRole.STUDENT || editingUser.role === UserRole.FACULTY) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Briefcase className="h-4 w-4 text-slate-400" />
                     </div>
                     <select
                        value={editingUser.department || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value, subject: undefined })}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white appearance-none"
                     >
                        <option value="">Select Department</option>
                        {DEPARTMENTS.map((dept) => (
                           <option key={dept} value={dept}>{dept}</option>
                        ))}
                     </select>
                  </div>
                </div>
              )}

              {editingUser.role === UserRole.FACULTY && editingUser.department && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Specialization</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <BookOpen className="h-4 w-4 text-slate-400" />
                     </div>
                     <select
                        value={editingUser.subject || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, subject: e.target.value })}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white appearance-none"
                     >
                        <option value="">Select Subject</option>
                        {SUBJECTS_BY_DEPT[editingUser.department]?.map((subj) => (
                           <option key={subj} value={subj}>{subj}</option>
                        ))}
                     </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
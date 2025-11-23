
import React, { useEffect, useState } from 'react';
import { storageService } from '../../services/storageService';
import { analysisService } from '../../services/analysisService';
import { AttendanceRecord, User, UserRole, ClassSession, AttendanceAlert } from '../../types';
import { Download, Users, FileText, CheckSquare, Search, Trash2, Edit, Save, X, Briefcase, BookOpen, BarChart3, Calendar, Filter, AlertTriangle, Hash, Settings, ShieldCheck, Activity, CheckCircle, ScanFace, MapPin } from 'lucide-react';
import Button from '../../components/Button';
import AlertsPanel from '../../components/AlertsPanel';
import { DEPARTMENTS, SUBJECTS_BY_DEPT, SYSTEM_CONFIG } from '../../utils/constants';

interface StudentReport {
  student: User;
  totalSessions: number;
  totalPresent: number;
  overallPercentage: number;
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'users' | 'reports'>('overview');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalFaculty: 0, totalSessions: 0, totalAttendance: 0 });
  const [alerts, setAlerts] = useState<AttendanceAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allUsers, allSessions, allAttendance, globalStats] = await Promise.all([
        storageService.getAllUsers(),
        storageService.getAllSessions(),
        storageService.getAllAttendance(),
        storageService.getGlobalStats()
      ]);
      
      setUsers(allUsers);
      setSessions(allSessions);
      setRecords(allAttendance);
      setStats(globalStats);
      
      const generatedAlerts = analysisService.generateAlerts(allUsers, allSessions, allAttendance);
      setAlerts(generatedAlerts);
    } catch (error) {
      console.error("Failed to load admin data", error);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      await storageService.deleteUser(uid);
      loadData();
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData(user);
    setIsEditModalOpen(true);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({ role: UserRole.STUDENT });
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await storageService.updateUser({ ...editingUser, ...formData } as User);
      } else {
        await storageService.saveUser({ 
            ...formData, 
            uid: Date.now().toString(),
            faceDataUrl: formData.faceDataUrl || undefined 
        } as User);
      }
      setIsEditModalOpen(false);
      loadData();
    } catch (error) {
      alert('Failed to save user');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.rollNo && u.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Students</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalStudents}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Users size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Faculty</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalFaculty}</h3>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
              <Briefcase size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sessions Held</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalSessions}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <Calendar size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Attendance</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalAttendance}</h3>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
              <CheckSquare size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Attendance</h3>
          <div className="space-y-4">
            {records.slice(0, 5).map(record => (
              <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                    {record.studentName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800 dark:text-white">{record.studentName}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{record.subject}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {new Date(record.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                  </span>
                  <div className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400 text-xs font-bold mt-1">
                    <CheckCircle size={12} /> Present
                  </div>
                </div>
              </div>
            ))}
            {records.length === 0 && <p className="text-slate-500">No records found.</p>}
          </div>
        </div>

        {/* Validation Results / System Config */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="text-indigo-500" size={20} /> Validation Results
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">System Metrics & Performance Data</p>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Geofence Radius</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{SYSTEM_CONFIG.GPS_RADIUS_METERS}m</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full" style={{width: '80%'}}></div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Face Match Threshold</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{SYSTEM_CONFIG.FACE_MATCH_THRESHOLD}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                 <div className="bg-green-500 h-1.5 rounded-full" style={{width: '60%'}}></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Lower score = Stricter match</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">QR Refresh Rate</span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{SYSTEM_CONFIG.QR_REFRESH_INTERVAL_MS / 1000}s</span>
              </div>
              <p className="text-[10px] text-slate-400">Dynamic token regeneration cycle</p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Avg. Latency</span>
                 <span className="text-sm font-bold text-blue-600 dark:text-blue-400">2.4s</span>
               </div>
               <p className="text-[10px] text-slate-400">End-to-end verification time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            User Management
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            Attendance Logs
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            Reports
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <AlertsPanel alerts={alerts} />
          <Button onClick={loadData} variant="outline" size="sm">Refresh</Button>
        </div>
      </div>

      {activeTab === 'overview' && renderOverview()}

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Search users by name, email, or roll no..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button onClick={handleAddUser}>
              <Users size={18} className="mr-2" /> Add User
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-bold uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Details</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                           {u.name.charAt(0)}
                         </div>
                         <div>
                           <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                           <p className="text-xs text-slate-500">{u.email}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        u.role === UserRole.ADMIN ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        u.role === UserRole.FACULTY ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">{u.department || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="text-xs">
                         {u.rollNo && <p><span className="text-slate-400">Roll:</span> {u.rollNo}</p>}
                         {u.subject && <p><span className="text-slate-400">Subj:</span> {u.subject}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEditUser(u)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded dark:hover:bg-indigo-900/30"><Edit size={16}/></button>
                      <button onClick={() => handleDeleteUser(u.uid)} className="p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/30"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
           <div className="overflow-x-auto max-h-[600px]">
             <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
               <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 font-bold uppercase text-xs sticky top-0 backdrop-blur-md bg-opacity-90">
                 <tr>
                   <th className="px-6 py-3">Time</th>
                   <th className="px-6 py-3">Student</th>
                   <th className="px-6 py-3">Subject</th>
                   <th className="px-6 py-3">Status</th>
                   <th className="px-6 py-3">Verification</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                 {records.map(r => (
                   <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                         <span className="font-medium text-slate-900 dark:text-white">
                           {new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                         </span>
                         <span className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleDateString()}</span>
                       </div>
                     </td>
                     <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{r.studentName}</td>
                     <td className="px-6 py-4">{r.subject}</td>
                     <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {r.status}
                       </span>
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex gap-2">
                         {r.verifiedByFace && <span className="p-1 bg-indigo-50 text-indigo-600 rounded" title="Face Verified"><ScanFace size={16} /></span>}
                         {r.verifiedByLocation && <span className="p-1 bg-blue-50 text-blue-600 rounded" title="Location Verified"><MapPin size={16} /></span>}
                         {!r.verifiedByFace && !r.verifiedByLocation && <span className="text-xs text-slate-400">Manual Entry</span>}
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-6 rounded-xl">
             <h3 className="text-lg font-bold text-amber-800 dark:text-amber-400 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} /> Attendance Alerts
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map(alert => (
                  <div key={alert.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-amber-100 dark:border-slate-700">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white">{alert.studentName}</h4>
                          <p className="text-xs text-slate-500">{alert.rollNo}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${alert.type === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {alert.type}
                        </span>
                     </div>
                     <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{alert.message}</p>
                     <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${alert.type === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{width: `${alert.attendancePercentage}%`}}
                        ></div>
                     </div>
                  </div>
                ))}
                {alerts.length === 0 && <p className="text-amber-600/70">No active alerts. Attendance is looking good!</p>}
             </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                   <input 
                      required
                      type="text" 
                      className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                   <select 
                      className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                      value={formData.role || UserRole.STUDENT}
                      onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                   >
                     <option value={UserRole.STUDENT}>Student</option>
                     <option value={UserRole.FACULTY}>Faculty</option>
                     <option value={UserRole.ADMIN}>Admin</option>
                   </select>
                 </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input 
                   required
                   type="email" 
                   className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                   value={formData.email || ''}
                   onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              {!editingUser && (
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                   <input 
                      required
                      type="password" 
                      className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                      value={formData.password || ''}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                   />
                 </div>
              )}

              {formData.role === UserRole.STUDENT && (
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Roll No</label>
                      <input 
                         type="text" 
                         className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                         value={formData.rollNo || ''}
                         onChange={e => setFormData({...formData, rollNo: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                      <select 
                         className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                         value={formData.department || ''}
                         onChange={e => setFormData({...formData, department: e.target.value})}
                      >
                         <option value="">Select Dept</option>
                         {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                 </div>
              )}

              {formData.role === UserRole.FACULTY && (
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                   <select 
                      className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                      value={formData.department || ''}
                      onChange={e => setFormData({...formData, department: e.target.value})}
                   >
                      <option value="">Select Dept</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                 </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} type="button">Cancel</Button>
                <Button type="submit">Save User</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;



import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { getCurrentLocation } from '../../services/geoService';
import { TimetableEntry, ClassSession, User, UserRole, AttendanceRecord, Feedback } from '../../types';
import { 
  LayoutDashboard, Calendar, Users, ClipboardCheck, Clock, Edit, XCircle, GripVertical,
  AlertTriangle, RefreshCw, X, Play, StopCircle, Trash2, MapPin, CheckCircle, MessageSquare, Send
} from 'lucide-react';
import Button from '../../components/Button';
import { SYSTEM_CONFIG } from '../../utils/constants';

// Constants
const DEFAULT_CLASS_DURATION_MINS = 60;
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper Functions
const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getScheduleStatus = (timetable: TimetableEntry[]) => {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = days[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let currentClassId = null;
  let nextClassId = null;
  let minDiff = Infinity;

  timetable.forEach(entry => {
    if (entry.day !== currentDay) return;
    
    const start = timeToMinutes(entry.startTime);
    const end = timeToMinutes(entry.endTime);
    
    if (currentMinutes >= start && currentMinutes < end) {
      currentClassId = entry.id;
    } else if (currentMinutes < start) {
      const diff = start - currentMinutes;
      if (diff < minDiff) {
        minDiff = diff;
        nextClassId = entry.id;
      }
    }
  });

  return { currentClassId, nextClassId };
};

// --- Helper Components ---

const FeedbackView: React.FC<{ user: User }> = ({ user }) => {
    const [type, setType] = useState<'bug' | 'feature' | 'general'>('general');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await storageService.submitFeedback({
                id: Date.now().toString(),
                userId: user.uid,
                userName: user.name,
                role: user.role,
                type,
                message,
                timestamp: Date.now(),
                status: 'new'
            });
            setSuccess(true);
            setMessage('');
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            alert("Failed to submit feedback.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <MessageSquare className="text-indigo-500" /> Help & Feedback
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Found a bug or have a suggestion? Let us know!</p>
            
            {success && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-2">
                    <CheckCircle size={20} /> Feedback submitted successfully!
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Feedback Type</label>
                    <div className="grid grid-cols-3 gap-3">
                        {['general', 'bug', 'feature'].map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t as any)}
                                className={`py-2 px-4 rounded-lg capitalize border transition-colors ${
                                    type === t 
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' 
                                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
                    <textarea
                        required
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={4}
                        className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Describe your issue or suggestion..."
                    />
                </div>
                <div className="flex justify-end">
                    <Button type="submit" isLoading={loading}>
                        <Send size={18} /> Submit Feedback
                    </Button>
                </div>
            </form>
        </div>
    );
};

const FullScreenQRCode = ({ sessionData, onClose }: { sessionData: ClassSession, onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
            <button onClick={onClose} className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors bg-white/10 p-2 rounded-full hover:bg-white/20">
                <X size={32}/>
            </button>
            <div className="bg-white p-10 rounded-3xl max-w-2xl w-full flex flex-col items-center animate-in fade-in zoom-in duration-300 shadow-2xl">
                <h2 className="text-4xl font-bold text-center mb-2 text-gray-900">{sessionData.subject}</h2>
                <p className="text-xl text-gray-500 mb-8">Scan this code to mark attendance</p>
                
                <div className="p-6 bg-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.1)] border border-gray-100">
                     {sessionData.currentQRCode ? (
                        <div className="bg-white">
                            <QRCode 
                                value={sessionData.currentQRCode} 
                                size={400} 
                                style={{ maxWidth: "100%", height: "auto" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                     ) : (
                        <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <RefreshCw className="animate-spin text-gray-400" size={64} />
                        </div>
                     )}
                </div>
                
                <div className="mt-8 flex items-center gap-3 text-lg font-medium text-indigo-700 bg-indigo-50 px-8 py-4 rounded-full border border-indigo-100">
                    <RefreshCw size={24} className="animate-spin text-indigo-600" />
                    Updating automatically for security
                </div>
            </div>
        </div>
    )
};

const ManualAttendance: React.FC<{ students: User[], subjects: string[], markManualAttendance: (uid: string, subject: string) => Promise<void> }> = ({ students, subjects, markManualAttendance }) => {
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [loading, setLoading] = useState(false);

    const handleMarkPresent = async () => {
        if (selectedStudent && selectedSubject) {
            setLoading(true);
            await markManualAttendance(selectedStudent, selectedSubject);
            setLoading(false);
            const studentName = students.find(s => s.uid === selectedStudent)?.name;
            alert(`Marked ${studentName} present for ${selectedSubject}.`);
            setSelectedStudent('');
            setSelectedSubject('');
        } else {
            alert("Please select a student and a subject.");
        }
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mt-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
               <ClipboardCheck className="text-indigo-500" size={24} /> Manual Attendance Entry
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white">
                    <option value="">Select Student</option>
                    {students.map(s => <option key={s.uid} value={s.uid}>{s.name} ({s.rollNo || s.email})</option>)}
                </select>
                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white">
                    <option value="">Select Subject</option>
                    {subjects.length > 0 ? subjects.map(sub => <option key={sub} value={sub}>{sub}</option>) : <option disabled>No subjects assigned</option>}
                </select>
                <Button onClick={handleMarkPresent} disabled={!selectedStudent || !selectedSubject || loading} isLoading={loading}>
                    Mark Present
                </Button>
            </div>
        </div>
    );
};

const TimetableManager: React.FC<{ 
    timetable: TimetableEntry[]; 
    subjects: string[];
    user: User;
    refreshTimetable: () => void;
}> = ({ timetable, subjects, user, refreshTimetable }) => {
    const [day, setDay] = useState<string>('Monday');
    const [time, setTime] = useState('');
    const [subject, setSubject] = useState(subjects.length > 0 ? subjects[0] : '');
    const [duration, setDuration] = useState(DEFAULT_CLASS_DURATION_MINS);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewedDay, setViewedDay] = useState<string>(DAYS_OF_WEEK[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
    const [scheduleStatus, setScheduleStatus] = useState({ currentClassId: null as string | null, nextClassId: null as string | null });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [conflictingId, setConflictingId] = useState<string | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    useEffect(() => {
        const updateStatus = () => setScheduleStatus(getScheduleStatus(timetable));
        updateStatus();
        const interval = setInterval(updateStatus, 60000);
        return () => clearInterval(interval);
    }, [timetable]);

    useEffect(() => {
        if (subjects.length > 0 && !subject && !editingId) setSubject(subjects[0]);
    }, [subjects, subject, editingId]);

    const handleEdit = (entry: TimetableEntry) => {
        setEditingId(entry.id);
        setDay(entry.day);
        setTime(entry.startTime);
        setSubject(entry.subject);
        
        const start = timeToMinutes(entry.startTime);
        const end = timeToMinutes(entry.endTime);
        setDuration(end - start);
        
        setViewedDay(entry.day);
        setError(null);
        setConflictingId(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setTime('');
        setDuration(DEFAULT_CLASS_DURATION_MINS);
        if (subjects.length > 0) setSubject(subjects[0]);
        setError(null);
        setConflictingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setConflictingId(null);
        
        if (!time || !subject || duration <= 0) {
            setError('Invalid inputs');
            return;
        }

        const newStart = timeToMinutes(time);
        const newEnd = newStart + duration;
        const endTimeStr = minutesToTime(newEnd);

        const conflict = timetable.find(entry => {
            if (entry.id === editingId) return false;
            if (entry.day !== day) return false;
            const existStart = timeToMinutes(entry.startTime);
            const existEnd = timeToMinutes(entry.endTime);
            return (newStart < existEnd && newEnd > existStart);
        });

        if (conflict) {
            setError(`Scheduling Conflict: Overlaps with ${conflict.subject} (${conflict.startTime}-${conflict.endTime})`);
            setConflictingId(conflict.id);
            setViewedDay(conflict.day);
            return;
        }

        setIsLoading(true);
        try {
            const newEntry: TimetableEntry = {
                id: editingId || Date.now().toString(),
                facultyId: user.uid,
                subject,
                day,
                startTime: time,
                endTime: endTimeStr
            };
            await storageService.addTimetableEntry(newEntry);
            refreshTimetable();
            if (editingId) setEditingId(null);
            setTime('');
            setDuration(DEFAULT_CLASS_DURATION_MINS);
        } catch (err) {
            console.error(err);
            setError('Failed to save schedule entry');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this class from the schedule?")) {
            await storageService.deleteTimetableEntry(id);
            refreshTimetable();
            if (editingId === id) handleCancelEdit();
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('text/plain', id);
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        setDraggedId(null);
        
        if (sourceId && sourceId !== targetId) {
            const sourceEntry = timetable.find(e => e.id === sourceId);
            const targetEntry = timetable.find(e => e.id === targetId);

            if (sourceEntry && targetEntry && sourceEntry.day === targetEntry.day) {
                if (window.confirm("Swap these two time slots?")) {
                    const updatedSource = { ...sourceEntry, startTime: targetEntry.startTime, endTime: targetEntry.endTime };
                    const updatedTarget = { ...targetEntry, startTime: sourceEntry.startTime, endTime: sourceEntry.endTime };
                    await Promise.all([
                        storageService.addTimetableEntry(updatedSource),
                        storageService.addTimetableEntry(updatedTarget)
                    ]);
                    refreshTimetable();
                }
            }
        }
    };

    const filteredEntries = timetable.filter(e => e.day === viewedDay).sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const conflictingIds = useMemo(() => {
        const ids = new Set<string>();
        const sorted = [...filteredEntries].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        for (let i = 0; i < sorted.length - 1; i++) {
            if (timeToMinutes(sorted[i].endTime) > timeToMinutes(sorted[i+1].startTime)) {
                ids.add(sorted[i].id);
                ids.add(sorted[i+1].id);
            }
        }
        return ids;
    }, [filteredEntries]);

    return (
        <div className="space-y-8">
             <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border transition-colors duration-300 ${editingId ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {editingId ? <Edit size={20} className="text-indigo-500"/> : <Calendar size={20} className="text-indigo-500"/>}
                        {editingId ? 'Edit Class Schedule' : 'Add New Class'}
                    </h3>
                    {editingId && (
                        <button onClick={handleCancelEdit} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
                            <XCircle size={16} /> Cancel Edit
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm flex items-center gap-2 border border-red-100 dark:border-red-900/50">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Day</label>
                        <select 
                            value={day} 
                            onChange={e => setDay(e.target.value)} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Start Time</label>
                        <input 
                            type="time" 
                            value={time} 
                            onChange={e => setTime(e.target.value)} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                            required 
                        />
                    </div>
                    <div>
                         <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Duration (min)</label>
                         <input 
                            type="number" 
                            value={duration} 
                            onChange={e => setDuration(Number(e.target.value))} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                            min="15" step="15" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                        <select 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <Button type="submit" isLoading={isLoading} variant={editingId ? 'primary' : 'secondary'}>
                        {editingId ? 'Update Class' : 'Add Class'}
                    </Button>
                </form>
             </div>

             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Weekly Schedule</h3>
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg overflow-x-auto">
                        {DAYS_OF_WEEK.map(d => (
                            <button key={d} onClick={() => setViewedDay(d)} className={`px-3 py-1 text-xs rounded-md transition-all whitespace-nowrap ${viewedDay === d ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                {d.substring(0,3)}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredEntries.length > 0 ? (
                    <div className="space-y-3">
                        {filteredEntries.map(entry => {
                             const isCurrent = entry.id === scheduleStatus.currentClassId;
                             const isNext = entry.id === scheduleStatus.nextClassId;
                             const isConflict = conflictingId === entry.id || conflictingIds.has(entry.id);
                             const isEditing = entry.id === editingId;
                             const isDragged = entry.id === draggedId;

                             return (
                                <div 
                                    key={entry.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, entry.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, entry.id)}
                                    className={`flex flex-col p-4 border rounded-lg transition-all duration-300 cursor-move relative group
                                    ${isConflict ? 'bg-red-50 border-red-400 ring-2 ring-red-200 dark:bg-red-900/30 dark:border-red-500' : 
                                      isEditing ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-500' :
                                      isCurrent ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 
                                      isNext ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-900' : 
                                      'bg-white border-slate-100 dark:bg-slate-700/30 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:shadow-md'}
                                    ${isDragged ? 'opacity-50' : 'opacity-100'}
                                `}>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-4">
                                            <div className="text-slate-300 group-hover:text-indigo-400 cursor-grab active:cursor-grabbing">
                                                <GripVertical size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-slate-800 dark:text-white">{entry.subject}</h4>
                                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 text-slate-500 px-2 py-0.5 rounded">
                                                        {entry.startTime} - {entry.endTime}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Clock size={12} /> {timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)} min
                                                    </span>
                                                    {isConflict && (
                                                        <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-bold">
                                                            <AlertTriangle size={12} /> Conflict
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(entry)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No classes scheduled for {viewedDay}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const FacultyDashboard: React.FC = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('view') || 'dashboard';

    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
    const [students, setStudents] = useState<User[]>([]);
    const [showFullScreenQR, setShowFullScreenQR] = useState(false);
    const [scheduleStatus, setScheduleStatus] = useState({ currentClassId: null as string | null, nextClassId: null as string | null });
    const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            refreshTimetable();
            loadActiveSession();
            loadStudents();
            handleRefreshLocation();
        }
    }, [user]);

    useEffect(() => {
        if (!activeSession) return;
        
        const interval = setInterval(async () => {
             // Generate dynamic QR token
             const token = Math.random().toString(36).substring(7);
             const timestamp = Date.now();
             // Format: SECURE:SESSION_ID:TIMESTAMP:TOKEN
             const qrContent = `SECURE:${activeSession.id}:${timestamp}:${token}`;
             
             await storageService.updateSessionQR(activeSession.id, qrContent, token, timestamp);
             
             setActiveSession(prev => prev ? ({ 
                 ...prev, 
                 currentQRCode: qrContent,
                 lastQrToken: token, 
                 lastQrTimestamp: timestamp 
             }) : null);
        }, SYSTEM_CONFIG.QR_REFRESH_INTERVAL_MS);
        
        return () => clearInterval(interval);
    }, [activeSession?.id]);

    useEffect(() => {
        const updateStatus = () => setScheduleStatus(getScheduleStatus(timetable));
        updateStatus();
        const interval = setInterval(updateStatus, 60000);
        return () => clearInterval(interval);
    }, [timetable]);

    const refreshTimetable = async () => {
        if (!user) return;
        const data = await storageService.getTimetable(user.uid);
        setTimetable(data);
    };

    const loadActiveSession = async () => {
        if (!user) return;
        const session = await storageService.getActiveSession(user.uid);
        setActiveSession(session || null);
    };

    const loadStudents = async () => {
        const allUsers = await storageService.getAllUsers();
        setStudents(allUsers.filter(u => u.role === UserRole.STUDENT));
    };

    const getLocationWithTimeout = (): Promise<{lat: number, lng: number}> => {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error("Location request timed out"));
            }, 5000);

            getCurrentLocation().then(loc => {
                clearTimeout(timeoutId);
                resolve(loc);
            }).catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
        });
    };

    const handleRefreshLocation = async () => {
        setLocationLoading(true);
        try {
            const loc = await getLocationWithTimeout();
            setCurrentLocation(loc);
        } catch (error) {
            console.error("Location error:", error);
            // Don't alert on auto-refresh, just log
        } finally {
            setLocationLoading(false);
        }
    };

    const handleStartSession = async (timetableId: string) => {
        if (!user) return;
        const entry = timetable.find(t => t.id === timetableId);
        if (!entry) return;

        if (window.confirm(`Start attendance session for ${entry.subject}?`)) {
            setStartingSessionId(timetableId);
            try {
                // Get location with timeout & race condition handling
                let location = { lat: 0, lng: 0 };
                try {
                     location = await getLocationWithTimeout();
                } catch (locError: any) {
                    console.error("Location retrieval failed", locError);
                    // If location fails, ask user if they want to proceed anyway
                    if (!window.confirm("Could not get GPS location. Students will not be geofenced. Proceed anyway?")) {
                        setStartingSessionId(null);
                        return;
                    }
                    // Proceed with 0,0 location (disabled geofence effectively)
                }
                
                const newSession: ClassSession = {
                    id: Date.now().toString(),
                    facultyId: user.uid,
                    subject: entry.subject,
                    startTime: Date.now(),
                    endTime: null,
                    isActive: true,
                    location: location, 
                    currentQRCode: '',
                };

                await storageService.createSession(newSession);
                await loadActiveSession();
            } catch (error: any) {
                console.error("Failed to start session", error);
                const msg = error.message || 'Could not start session';
                alert(`System Error: ${msg}. Please check your connection.`);
            } finally {
                setStartingSessionId(null);
            }
        }
    };

    const handleEndSession = async () => {
        if (!activeSession) return;
        if (window.confirm("End current session?")) {
            await storageService.endSession(activeSession.id);
            setActiveSession(null);
        }
    };

    const handleMarkManualAttendance = async (studentId: string, subject: string) => {
        if (!user) return;
        const record: AttendanceRecord = {
            id: Date.now().toString(),
            sessionId: activeSession ? activeSession.id : `manual-${Date.now()}`,
            studentId,
            studentName: students.find(s => s.uid === studentId)?.name || 'Unknown',
            subject,
            timestamp: Date.now(),
            status: 'present',
            verifiedByFace: false,
            verifiedByLocation: false
        };
        await storageService.markAttendance(record);
    };

    // Derived State
    const subjects = user?.subject 
        ? [user.subject] 
        : user?.department 
            ? Array.from(new Set(timetable.map(t => t.subject))) 
            : [];

    const currentClass = timetable.find(t => t.id === scheduleStatus.currentClassId);
    const nextClass = timetable.find(t => t.id === scheduleStatus.nextClassId);

    if (!user) return <div>Loading...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            
            {/* active session banner */}
            {activeSession && (
                <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm animate-pulse">
                            <RefreshCw size={32} className="animate-spin" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{activeSession.subject}</h2>
                            <p className="text-indigo-100 opacity-90 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span> Live Attendance Session
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <Button onClick={() => setShowFullScreenQR(true)} className="bg-white text-indigo-600 hover:bg-indigo-50 border-0">
                             Show QR Code
                         </Button>
                         <Button onClick={handleEndSession} className="bg-red-500 hover:bg-red-600 text-white border-0">
                             <StopCircle size={18} className="mr-2"/> End Session
                         </Button>
                    </div>
                </div>
            )}

            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Quick Actions Card */}
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                         <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                             <LayoutDashboard className="text-indigo-500" size={20} /> Current Status
                         </h3>
                         
                         {currentClass ? (
                             <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-xl p-4">
                                 <div className="flex justify-between items-start">
                                     <div>
                                         <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Happening Now</span>
                                         <h4 className="text-xl font-bold text-slate-800 dark:text-white mt-1">{currentClass.subject}</h4>
                                         <p className="text-sm text-slate-500 dark:text-slate-400">{currentClass.startTime} - {currentClass.endTime}</p>
                                     </div>
                                     {!activeSession ? (
                                         <Button 
                                            onClick={() => handleStartSession(currentClass.id)} 
                                            className="shadow-lg shadow-green-500/20"
                                            isLoading={startingSessionId === currentClass.id}
                                         >
                                             <Play size={18} className="mr-2" /> Start Class
                                         </Button>
                                     ) : (
                                        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full text-xs font-bold flex items-center gap-1">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Active
                                        </div>
                                     )}
                                 </div>
                             </div>
                         ) : nextClass ? (
                             <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900 rounded-xl p-4">
                                 <div className="flex justify-between items-start">
                                     <div>
                                         <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Up Next</span>
                                         <h4 className="text-xl font-bold text-slate-800 dark:text-white mt-1">{nextClass.subject}</h4>
                                         <p className="text-sm text-slate-500 dark:text-slate-400">{nextClass.startTime} - {nextClass.endTime}</p>
                                     </div>
                                     <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
                                         Wait to Start
                                     </Button>
                                 </div>
                             </div>
                         ) : (
                            <div className="text-center py-8 text-slate-400">
                                No classes scheduled right now.
                            </div>
                         )}

                         <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3">
                             <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                                 <span>System Ready</span>
                                 <span className="text-green-500 font-bold flex items-center gap-1"><CheckCircle size={14}/> Online</span>
                             </div>
                             
                             {/* Location Refresh Block */}
                             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${currentLocation ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-300'}`}>
                                        <MapPin size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">GPS Location</p>
                                        <p className="text-[10px] text-slate-500 font-mono">
                                            {locationLoading ? 'Locating...' : currentLocation ? `${currentLocation.lat}, ${currentLocation.lng}` : 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleRefreshLocation} isLoading={locationLoading} className="h-8 text-xs bg-white dark:bg-slate-800 gap-1">
                                    <RefreshCw size={12} className={locationLoading ? "animate-spin" : ""} /> Refresh
                                </Button>
                            </div>

                             <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                 <div className="bg-green-500 h-1.5 rounded-full w-full"></div>
                             </div>
                         </div>
                     </div>
                     
                     {/* Stats / Info */}
                     <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                             <Users className="text-purple-500" size={20} /> My Students
                        </h3>
                        <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                                 <span className="text-slate-600 dark:text-slate-300">Total Assigned</span>
                                 <span className="font-bold text-slate-900 dark:text-white text-lg">{students.length}</span>
                             </div>
                             <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                                 <span className="text-slate-600 dark:text-slate-300">Avg. Attendance</span>
                                 <span className="font-bold text-green-600 dark:text-green-400 text-lg">87%</span>
                             </div>
                        </div>
                     </div>
                </div>
            )}

            {activeTab === 'timetable' && (
                <TimetableManager 
                    timetable={timetable} 
                    subjects={subjects} 
                    user={user} 
                    refreshTimetable={refreshTimetable} 
                />
            )}
            
            {activeTab === 'students' && (
                 <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Student List</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Roll No</th>
                                    <th className="px-6 py-3">Department</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(student => (
                                    <tr key={student.uid} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{student.name}</td>
                                        <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400">{student.rollNo || '-'}</td>
                                        <td className="px-6 py-4">{student.department}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>
            )}
            
            {activeTab === 'attendance' && (
                <ManualAttendance 
                    students={students} 
                    subjects={subjects} 
                    markManualAttendance={handleMarkManualAttendance} 
                />
            )}
            
            {activeTab === 'feedback' && (
                <FeedbackView user={user} />
            )}

            {showFullScreenQR && activeSession && (
                <FullScreenQRCode 
                    sessionData={activeSession} 
                    onClose={() => setShowFullScreenQR(false)} 
                />
            )}
        </div>
    );
};

export default FacultyDashboard;

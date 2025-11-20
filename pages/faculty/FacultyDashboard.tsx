
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { getCurrentLocation, calculateDistance } from '../../services/geoService';
import { TimetableEntry, ClassSession, User, UserRole, AttendanceRecord, GeoLocation } from '../../types';
import { 
  LayoutDashboard, Calendar, Users, ClipboardCheck, User as UserIcon, LogOut, Trash2, 
  Menu, X, Sun, Moon, Camera, CheckCircle, AlertTriangle, RefreshCw, MapPin, Play, StopCircle, Clock, Edit, XCircle, GripVertical,
  Search, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';

// Constants
const QR_REFRESH_INTERVAL_MS = 10000;
const MAX_FACULTY_MOVEMENT_METERS = 100;
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

    // New State for Edit/Conflict
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

    // Clear conflict error when inputs change
    useEffect(() => {
        if (conflictingId) {
            setConflictingId(null);
            setError(null);
        }
    }, [day, time, duration, subject]);

    const handleEdit = (entry: TimetableEntry) => {
        setEditingId(entry.id);
        setDay(entry.day);
        setTime(entry.startTime);
        setSubject(entry.subject);
        
        const start = timeToMinutes(entry.startTime);
        const end = timeToMinutes(entry.endTime);
        setDuration(end - start);
        
        setViewedDay(entry.day); // Switch view to the day being edited
        setError(null);
        setConflictingId(null);
        
        // Scroll to top to show form
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

        // Check overlap
        const conflict = timetable.find(entry => {
            if (entry.id === editingId) return false; // Ignore self if editing
            if (entry.day !== day) return false;
            const existStart = timeToMinutes(entry.startTime);
            const existEnd = timeToMinutes(entry.endTime);
            // (StartA < EndB) and (EndA > StartB)
            return (newStart < existEnd && newEnd > existStart);
        });

        if (conflict) {
            setError(`Conflict with ${conflict.subject} (${conflict.startTime}-${conflict.endTime})`);
            setConflictingId(conflict.id);
            setViewedDay(conflict.day); // Show the conflict
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
            
            if (editingId) {
                setEditingId(null);
            }
            setTime('');
            setDuration(DEFAULT_CLASS_DURATION_MINS);
        } catch (err) {
            console.error(err);
            setError('Failed to save');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Delete this class?")) {
            await storageService.deleteTimetableEntry(id);
            refreshTimetable();
            if (editingId === id) handleCancelEdit();
        }
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('text/plain', id);
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleSwapTimes = async (sourceId: string, targetId: string) => {
        const sourceEntry = timetable.find(e => e.id === sourceId);
        const targetEntry = timetable.find(e => e.id === targetId);

        if (!sourceEntry || !targetEntry || sourceEntry.day !== targetEntry.day) return;

        // Swap start/end times
        const updatedSource = { 
            ...sourceEntry, 
            startTime: targetEntry.startTime, 
            endTime: targetEntry.endTime 
        };
        
        const updatedTarget = { 
            ...targetEntry, 
            startTime: sourceEntry.startTime, 
            endTime: sourceEntry.endTime 
        };

        setIsLoading(true);
        try {
            await Promise.all([
                storageService.addTimetableEntry(updatedSource),
                storageService.addTimetableEntry(updatedTarget)
            ]);
            refreshTimetable();
        } catch (e) {
            console.error("Swap failed", e);
            setError("Failed to reorder schedule");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        setDraggedId(null);
        
        if (sourceId && sourceId !== targetId) {
            if (window.confirm("Swap these two time slots?")) {
                handleSwapTimes(sourceId, targetId);
            }
        }
    };

    const filteredEntries = timetable.filter(e => e.day === viewedDay).sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // Calculate conflicts for visualization
    const conflictingIds = useMemo(() => {
        const ids = new Set<string>();
        const sorted = [...filteredEntries].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i+1];
            const currentEnd = timeToMinutes(current.endTime);
            const nextStart = timeToMinutes(next.startTime);
            
            if (currentEnd > nextStart) {
                ids.add(current.id);
                ids.add(next.id);
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
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-lg text-sm flex items-center gap-2 animate-pulse border border-red-100 dark:border-red-900/50">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Day</label>
                        <select 
                            value={day} 
                            onChange={e => setDay(e.target.value)} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                            required 
                        />
                    </div>
                    <div>
                         <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Duration (min)</label>
                         <input 
                            type="number" 
                            value={duration} 
                            onChange={e => setDuration(Number(e.target.value))} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                            min="15" 
                            step="15" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Subject</label>
                        <select 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)} 
                            className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <Button type="submit" isLoading={isLoading} variant={editingId ? 'primary' : 'secondary'} className={editingId ? 'bg-indigo-600 hover:bg-indigo-700' : ''}>
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
                                            {/* Drag Handle */}
                                            <div className="text-slate-300 group-hover:text-indigo-400 cursor-grab active:cursor-grabbing">
                                                <GripVertical size={20} />
                                            </div>
                                            
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg 
                                                ${isConflict ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200' : 
                                                  isCurrent ? 'bg-green-100 text-green-700' : 
                                                  'bg-indigo-100 text-indigo-700 dark:bg-slate-700 dark:text-indigo-400'}`}>
                                                {entry.subject.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white">{entry.subject}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <Clock size={12} /> {entry.startTime} - {entry.endTime}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 self-center">
                                            {isCurrent && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded animate-pulse">NOW</span>}
                                            {isNext && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">NEXT</span>}
                                            
                                            <div className="flex gap-1">
                                                <button type="button" onClick={() => handleEdit(entry)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Edit Class">
                                                    <Edit size={18} />
                                                </button>
                                                <button type="button" onClick={() => handleDelete(entry.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Delete Class">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Expanded Conflict UI inside card */}
                                    {isConflict && (
                                        <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/50 rounded-md border border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-200 animate-in fade-in slide-in-from-top-2">
                                            <AlertTriangle size={16} className="flex-shrink-0" />
                                            <span className="font-medium">Scheduling Conflict Detected:</span>
                                            <span>This class overlaps with another session.</span>
                                        </div>
                                    )}
                                </div>
                             );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">No classes scheduled for {viewedDay}</div>
                )}
             </div>
        </div>
    );
};

const StudentList: React.FC<{ students: User[] }> = ({ students }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStudents = useMemo(() => {
        let sortableItems = [...students];
        
        // Filter
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            sortableItems = sortableItems.filter(student => 
                student.name.toLowerCase().includes(lowerTerm) ||
                (student.rollNo && student.rollNo.toLowerCase().includes(lowerTerm)) ||
                student.email.toLowerCase().includes(lowerTerm) ||
                (student.department && student.department.toLowerCase().includes(lowerTerm))
            );
        }

        // Sort
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof User];
                let bValue: any = b[sortConfig.key as keyof User];

                // Handle derived status
                if (sortConfig.key === 'status') {
                    aValue = !!a.faceDataUrl;
                    bValue = !!b.faceDataUrl;
                }

                // Handle nulls/undefined
                if (!aValue) aValue = '';
                if (!bValue) bValue = '';

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [students, searchTerm, sortConfig]);

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="text-slate-400 opacity-50 group-hover:opacity-100" />;
        return sortConfig.direction === 'asc' 
            ? <ChevronUp size={14} className="text-indigo-500" /> 
            : <ChevronDown size={14} className="text-indigo-500" />;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users size={20} className="text-indigo-500"/> Registered Students
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Total: {sortedStudents.length} {searchTerm && `(filtered from ${students.length})`}
                    </p>
                </div>
                
                <div className="relative w-full sm:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search name, roll no..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg leading-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                    />
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 uppercase text-xs font-semibold text-slate-500 dark:text-slate-400 border-b dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-2">Name <SortIcon columnKey="name"/></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('rollNo')}>
                                <div className="flex items-center gap-2">Roll No <SortIcon columnKey="rollNo"/></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('email')}>
                                <div className="flex items-center gap-2">Email <SortIcon columnKey="email"/></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('department')}>
                                <div className="flex items-center gap-2">Department <SortIcon columnKey="department"/></div>
                            </th>
                            <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => handleSort('status')}>
                                <div className="flex items-center gap-2">Status <SortIcon columnKey="status"/></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sortedStudents.length > 0 ? sortedStudents.map((s) => (
                            <tr key={s.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                                            {s.name.charAt(0)}
                                        </div>
                                        <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{s.rollNo || '-'}</td>
                                <td className="px-6 py-4 break-all">{s.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                        {s.department || 'General'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {s.faceDataUrl ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30">
                                            <CheckCircle size={12} /> Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
                                            <AlertTriangle size={12} /> Pending
                                        </span>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users size={32} className="opacity-20" />
                                        <p>No students found matching your search.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AttendanceReport: React.FC<{ attendance: AttendanceRecord[], students: User[] }> = ({ attendance, students }) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Attendance</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Verification</th>
                            <th className="px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {attendance.slice(0, 20).map(r => (
                            <tr key={r.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                <td className="px-4 py-3 whitespace-nowrap">{new Date(r.timestamp).toLocaleString()}</td>
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{r.studentName}</td>
                                <td className="px-4 py-3 whitespace-nowrap">{r.subject}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex gap-1">
                                        {r.verifiedByFace && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Face</span>}
                                        {r.verifiedByLocation && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">GPS</span>}
                                        {!r.verifiedByFace && !r.verifiedByLocation && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Manual</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3"><span className="text-green-600 font-bold text-xs">Present</span></td>
                            </tr>
                        ))}
                        {attendance.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No records found</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const FacultyProfile: React.FC<{ user: User, update: (u: User) => void }> = ({ user, update }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user.name);
    const [subject, setSubject] = useState(user.subject || '');
    
    const handleSave = async () => {
        const updated = { ...user, name, subject };
        await storageService.updateUser(updated);
        update(updated);
        setIsEditing(false);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto">
            <div className="flex items-center gap-6 mb-8">
                <div className="w-24 h-24 bg-indigo-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-3xl font-bold">
                    {user.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{user.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 break-all">{user.email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase rounded dark:bg-indigo-900/30 dark:text-indigo-300">Faculty</span>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        disabled={!isEditing}
                        className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white disabled:opacity-60"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Department</label>
                    <input 
                        type="text" 
                        value={user.department || ''} 
                        disabled
                        className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Subject Specialization</label>
                    <input 
                        type="text" 
                        value={subject} 
                        onChange={e => setSubject(e.target.value)}
                        disabled={!isEditing}
                        className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white disabled:opacity-60"
                    />
                </div>
                
                <div className="flex justify-end pt-4">
                    {isEditing ? (
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button onClick={handleSave}>Save Changes</Button>
                        </div>
                    ) : (
                        <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                    )}
                </div>
            </div>
        </div>
    );
};


const FacultyDashboard: React.FC = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const view = searchParams.get('view') || 'dashboard';
    const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
    const [showFullScreenQR, setShowFullScreenQR] = useState(false);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [students, setStudents] = useState<User[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [countdown, setCountdown] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initialLocation, setInitialLocation] = useState<GeoLocation | null>(null);

    // Load Data
    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const [t, u, a, s] = await Promise.all([
                storageService.getTimetable(user.uid),
                storageService.getAllUsers(),
                storageService.getAllAttendance(),
                storageService.getActiveSession(user.uid)
            ]);
            
            setTimetable(t);
            setStudents(u.filter(user => user.role === UserRole.STUDENT));
            setAttendance(a.filter(rec => rec.subject === user.subject || t.some(e => e.subject === rec.subject)));
            
            if (s) {
                setActiveSession(s);
                setInitialLocation(s.location);
            }
            
        } catch (e) {
            console.error(e);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Derived subjects from profile + timetable
    const facultySubjects = useMemo(() => {
        const set = new Set<string>();
        if (user?.subject) set.add(user.subject);
        timetable.forEach(t => set.add(t.subject));
        return Array.from(set);
    }, [user, timetable]);

    // Session Logic
    const startSession = async () => {
        if (!user?.subject && facultySubjects.length === 0) {
            setError("No subjects assigned. Please update your profile or timetable.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Ensure we get a valid location
            const location = await getCurrentLocation();
            if (!location || (location.lat === 0 && location.lng === 0)) {
               throw new Error("Could not fetch valid location. Please check your GPS settings.");
            }

            const sessionId = Date.now().toString();
            const token = Math.random().toString(36).substring(7);
            const timestamp = Date.now();
            const qrData = `SECURE:${sessionId}:${timestamp}:${token}`;

            // Default to user's primary subject, or first from list
            const sessionSubject = user?.subject || facultySubjects[0];

            const newSession: ClassSession = {
                id: sessionId,
                facultyId: user!.uid,
                subject: sessionSubject,
                startTime: Date.now(),
                endTime: null,
                isActive: true,
                location,
                currentQRCode: qrData,
                lastQrToken: token,
                lastQrTimestamp: timestamp
            };

            await storageService.createSession(newSession);
            setActiveSession(newSession);
            setInitialLocation(location);
            setShowFullScreenQR(true);
        } catch (err: any) {
            setError(err.message || "Failed to start session. Check location permissions.");
        } finally {
            setLoading(false);
        }
    };

    const stopSession = async () => {
        if (activeSession) {
            await storageService.endSession(activeSession.id);
            setActiveSession(null);
            setShowFullScreenQR(false);
        }
    };

    // QR Rotation & Location Check
    useEffect(() => {
        if (!activeSession) {
            setCountdown(0);
            return;
        }

        const interval = setInterval(async () => {
            try {
                // 1. Update QR
                const token = Math.random().toString(36).substring(7);
                const timestamp = Date.now();
                const qrData = `SECURE:${activeSession.id}:${timestamp}:${token}`;
                await storageService.updateSessionQR(activeSession.id, qrData, token, timestamp);
                
                setActiveSession(prev => prev ? ({ ...prev, currentQRCode: qrData }) : null);
                setCountdown(QR_REFRESH_INTERVAL_MS / 1000);

                // 2. Check Location
                if (initialLocation) {
                    const currentLoc = await getCurrentLocation();
                    const dist = calculateDistance(initialLocation, currentLoc);
                    if (dist > MAX_FACULTY_MOVEMENT_METERS) {
                        stopSession();
                        setError("Session stopped: You moved too far from the class location.");
                    }
                }
            } catch (e) {
                console.error("Session update failed", e);
            }
        }, QR_REFRESH_INTERVAL_MS);

        const countdownInterval = setInterval(() => {
            setCountdown(c => c > 0 ? c - 1 : 0);
        }, 1000);

        return () => {
            clearInterval(interval);
            clearInterval(countdownInterval);
        };
    }, [activeSession, initialLocation]);

    const handleManualAttendance = async (uid: string, subject: string) => {
        if (!user) return;
        const student = students.find(s => s.uid === uid);
        if (!student) return;

        const record: AttendanceRecord = {
            id: Date.now().toString(),
            sessionId: 'manual-' + Date.now(),
            studentId: uid,
            studentName: student.name,
            subject: subject,
            timestamp: Date.now(),
            status: 'present',
            verifiedByFace: false,
            verifiedByLocation: false
        };
        
        await storageService.markAttendance(record);
        loadData();
    };

    if (!user) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertTriangle /> {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X size={16}/></button>
                </div>
            )}

            {view === 'dashboard' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Session Card */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${activeSession ? 'bg-green-100 text-green-600 animate-pulse' : 'bg-indigo-100 text-indigo-600 dark:bg-slate-700 dark:text-indigo-400'}`}>
                                {activeSession ? <RefreshCw size={40} className="animate-spin-slow" /> : <Play size={40} className="ml-1" />}
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                                {activeSession ? 'Class in Session' : 'Start Class'}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
                                {activeSession 
                                    ? `Attendance is active for ${activeSession.subject}. QR refreshes in ${countdown}s.` 
                                    : 'Begin a new attendance session. This will generate a dynamic QR code.'}
                            </p>
                            
                            {activeSession ? (
                                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                                    <Button onClick={() => setShowFullScreenQR(true)} className="flex-1">
                                        <RefreshCw size={20} className="mr-2" /> Show QR
                                    </Button>
                                    <Button variant="danger" onClick={stopSession} className="flex-1">
                                        <StopCircle size={20} className="mr-2" /> End Class
                                    </Button>
                                </div>
                            ) : (
                                <Button size="lg" onClick={startSession} isLoading={loading} className="w-full max-w-sm py-4 shadow-xl shadow-indigo-200/50 dark:shadow-none">
                                    Start Attendance Session
                                </Button>
                            )}
                        </div>

                        {/* Quick Stats */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                             <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Today's Overview</h3>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                     <span className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold uppercase">Classes</span>
                                     <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{timetable.filter(t => t.day === DAYS_OF_WEEK[new Date().getDay()-1]).length}</div>
                                 </div>
                                 <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/50">
                                     <span className="text-green-600 dark:text-green-400 text-sm font-semibold uppercase">Students</span>
                                     <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{students.length}</div>
                                 </div>
                                 <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/50 col-span-2">
                                     <span className="text-orange-600 dark:text-orange-400 text-sm font-semibold uppercase">Recent Attendance</span>
                                     <div className="text-3xl font-bold text-slate-800 dark:text-white mt-1">
                                        {attendance.filter(r => r.timestamp > Date.now() - 86400000).length}
                                     </div>
                                     <p className="text-xs text-slate-500 mt-1">Marked in last 24 hours</p>
                                 </div>
                             </div>
                        </div>
                    </div>

                    <ManualAttendance 
                        students={students} 
                        subjects={facultySubjects} 
                        markManualAttendance={handleManualAttendance} 
                    />
                </>
            )}

            {view === 'timetable' && (
                <TimetableManager 
                    timetable={timetable} 
                    subjects={facultySubjects} 
                    user={user} 
                    refreshTimetable={loadData} 
                />
            )}

            {view === 'students' && <StudentList students={students} />}
            
            {view === 'attendance' && <AttendanceReport attendance={attendance} students={students} />}
            
            {view === 'profile' && <FacultyProfile user={user} update={(u) => {}} />}

            {showFullScreenQR && activeSession && (
                <FullScreenQRCode sessionData={activeSession} onClose={() => setShowFullScreenQR(false)} />
            )}
        </div>
    );
};

export default FacultyDashboard;

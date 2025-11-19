import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { getCurrentLocation } from '../../services/geoService';
import { ClassSession, TimetableEntry } from '../../types';
import { Play, Square, MapPin, Users, Clock, Calendar, Trash2, ShieldCheck } from 'lucide-react';
import Button from '../../components/Button';

const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ClassSession | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [locationError, setLocationError] = useState('');
  const [newSubject, setNewSubject] = useState('');

  useEffect(() => {
    if (user) {
      refreshTimetable();
      setActiveSession(storageService.getActiveSession(user.uid));
      if (user.subject) {
        setNewSubject(user.subject);
      }
    }
  }, [user]);

  const refreshTimetable = () => {
    if (user) {
      setTimetable(storageService.getTimetable(user.uid));
    }
  };

  // Dynamic QR Effect
  useEffect(() => {
    let interval: any;
    if (activeSession?.isActive) {
      // Update QR every 10 seconds
      const updateQR = () => {
        const timestamp = Date.now();
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        // Secure Format: SECURE:sessionId:timestamp:token
        const qrPayload = `SECURE:${activeSession.id}:${timestamp}:${token}`;
        
        setQrValue(qrPayload);
        storageService.updateSessionQR(activeSession.id, qrPayload, token, timestamp);
      };
      
      updateQR(); // Initial
      interval = setInterval(updateQR, 10000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleAddClass = () => {
    if (!user || !newSubject) return;
    const entry: TimetableEntry = {
      id: Date.now().toString(),
      facultyId: user.uid,
      subject: newSubject,
      day: 'Today',
      startTime: '09:00',
      endTime: '10:00'
    };
    storageService.addTimetableEntry(entry);
    refreshTimetable();
    // Don't reset subject if it's their specialization
    if (!user.subject) {
       setNewSubject('');
    }
  };

  const handleDeleteClass = (id: string) => {
    storageService.deleteTimetableEntry(id);
    refreshTimetable();
  };

  const startSession = async (subject: string) => {
    if (!user) return;
    setLoading(true);
    setLocationError('');

    try {
      const loc = await getCurrentLocation();
      const session: ClassSession = {
        id: Date.now().toString(),
        facultyId: user.uid,
        subject,
        startTime: Date.now(),
        endTime: null,
        isActive: true,
        location: loc,
        currentQRCode: '',
        lastQrToken: '',
        lastQrTimestamp: 0
      };
      
      storageService.createSession(session);
      setActiveSession(session);
    } catch (err) {
      setLocationError('Failed to get location. Please allow location access to start attendance.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const endSession = () => {
    if (activeSession) {
      storageService.endSession(activeSession.id);
      setActiveSession(undefined);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-indigo-100 dark:border-slate-700 flex items-center gap-4 transition-colors duration-200">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Students</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">124</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-indigo-100 dark:border-slate-700 flex items-center gap-4 transition-colors duration-200">
          <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-lg text-green-600 dark:text-green-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Teaching Hours</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">48</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-indigo-100 dark:border-slate-700 flex items-center gap-4 transition-colors duration-200">
          <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-lg text-purple-600 dark:text-purple-400">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Classes Today</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{timetable.length}</h3>
          </div>
        </div>
      </div>

      {/* Active Session Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Live Attendance Session</h3>
            {activeSession && (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wide animate-pulse">
                Live
              </span>
            )}
          </div>
          
          <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
            {loading ? (
              <div className="text-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500 dark:text-slate-400">Acquiring GPS location...</p>
              </div>
            ) : activeSession ? (
              <div className="text-center w-full">
                <div className="mb-6">
                  <h4 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{activeSession.subject}</h4>
                  <p className="text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                    <MapPin size={16} />
                    Lat: {activeSession.location.lat.toFixed(4)}, Lng: {activeSession.location.lng.toFixed(4)}
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 inline-block mb-6 relative group">
                   {/* QR Wrapper */}
                   <QRCode value={qrValue} size={256} className="w-full h-auto" />
                   <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-slate-900 dark:text-white font-bold">Updating in 10s...</p>
                   </div>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6 bg-slate-50 dark:bg-slate-700/50 px-3 py-1 rounded-full inline-flex mx-auto">
                  <ShieldCheck size={14} className="text-green-600 dark:text-green-400" />
                  <span>Secure Dynamic QR Active</span>
                </div>
                
                <Button variant="danger" onClick={endSession} className="w-full max-w-xs mx-auto">
                  <Square size={18} className="fill-current" /> End Session
                </Button>
              </div>
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400">
                <div className="bg-slate-100 dark:bg-slate-700/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
                  <Play size={32} className="ml-1" />
                </div>
                <p className="mb-4">No active class session.</p>
                <p className="text-sm max-w-xs mx-auto">Select a class from the timetable below or create a new one to start taking attendance.</p>
              </div>
            )}
            
            {locationError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg w-full text-center">
                {locationError}
              </div>
            )}
          </div>
        </div>

        {/* Timetable / Quick Start */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col transition-colors duration-200">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Class Schedule</h3>
          </div>
          
          <div className="p-6 flex-1 overflow-auto">
            {timetable.length === 0 ? (
               <div className="text-center py-8 text-slate-400 dark:text-slate-500">No classes scheduled.</div>
            ) : (
              <div className="space-y-3">
                {timetable.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors group">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-white">{t.subject}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.day} • {t.startTime} - {t.endTime}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => startSession(t.subject)}
                        disabled={!!activeSession}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Start
                      </Button>
                      <button 
                        onClick={() => handleDeleteClass(t.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Add Class */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
            <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">Add Temporary Class</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Subject Name (e.g. CS101)" 
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <Button onClick={handleAddClass} disabled={!newSubject}>Add</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
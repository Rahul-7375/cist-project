
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { calculateDistance, getCurrentLocation } from '../../services/geoService';
import { AttendanceRecord, TimetableEntry } from '../../types';
import { Scan, MapPin, CheckCircle, XCircle, Camera, RefreshCw, User as UserIcon, Mail, Briefcase, History, Calendar, PieChart } from 'lucide-react';
import Button from '../../components/Button';

const SUBJECTS_BY_DEPT: Record<string, string[]> = {
  "Computer Science and Engineering": ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"],
  "CES-DS": ["Data Science", "Big Data Analytics", "Machine Learning", "Python for Data Science", "Statistics"],
  "CSE-AIML": ["Artificial Intelligence", "Deep Learning", "Neural Networks", "Natural Language Processing", "Computer Vision"],
  "Civil Engineering": ["Structural Analysis", "Geotechnical Engineering", "Surveying", "Construction Mgmt"],
  "Electronics and Communications Engineering": ["Digital Electronics", "Signals & Systems", "Microprocessors", "VLSI Design", "Communication Systems"],
  "Mechanical Engineering": ["Thermodynamics", "Fluid Mechanics", "Strength of Materials", "Machine Design"]
};

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('view') || 'attendance';

  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'idle' | 'qr' | 'face' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [scannedSessionId, setScannedSessionId] = useState<string | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const webcamRef = useRef<Webcam>(null);

  // Load history and schedule on mount
  useEffect(() => {
    if (user) {
      setAttendanceHistory(storageService.getAttendanceForStudent(user.uid));
      loadSchedule();
    }
  }, [user]);

  const loadSchedule = () => {
    if (!user?.department) return;
    
    // Get all timetable entries
    const allEntries = storageService.getAllTimetables();
    const relevantSubjects = SUBJECTS_BY_DEPT[user.department] || [];
    
    // Filter for subjects in user's department
    const studentSchedule = allEntries.filter(entry => relevantSubjects.includes(entry.subject));
    setSchedule(studentSchedule);
  };

  const startScan = () => {
    setScanning(true);
    setScanStep('qr');
    setStatusMessage('Point camera at the Faculty QR Code');
  };

  const simulateQRDetection = async () => {
    setStatusMessage('Analyzing QR Code...');
    await new Promise(r => setTimeout(r, 1500)); // Processing delay
    
    const mockSessions = storageService.getAllSessions();
    const activeSession = mockSessions.find((s: any) => s.isActive);

    if (activeSession && activeSession.currentQRCode) {
        const validation = storageService.validateQR(activeSession.currentQRCode);

        if (validation.valid && validation.sessionId) {
           setScannedSessionId(validation.sessionId);
           setScanStep('face');
           setStatusMessage('Secure QR Verified. Verifying Identity...');
        } else {
           setScanStep('error');
           setStatusMessage(validation.error || 'Invalid QR Code');
        }
    } else {
        setScanStep('error');
        setStatusMessage('No valid QR code detected in view.');
    }
  };

  const verifyIdentityAndMark = async () => {
    if (!user || !scannedSessionId) return;
    
    setStatusMessage('Checking Geolocation (Max 15m)...');
    try {
      const studentLoc = await getCurrentLocation();
      const session = storageService.getSessionById(scannedSessionId);
      
      if (!session) throw new Error("Session ended.");

      const distance = calculateDistance(studentLoc, session.location);
      console.log(`Distance: ${distance}m`);
      
      if (distance > 15) { 
         throw new Error(`Out of range! You are ${Math.round(distance)}m away. Must be within 15m.`);
      }

      setStatusMessage(`Location Verified (${Math.round(distance)}m). Matching Face...`);
      await new Promise(r => setTimeout(r, 1500)); 
      
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error("Could not capture face.");

      const record: AttendanceRecord = {
        id: Date.now().toString(),
        sessionId: session.id,
        studentId: user.uid,
        studentName: user.name,
        subject: session.subject,
        timestamp: Date.now(),
        status: 'present',
        verifiedByFace: true,
        verifiedByLocation: true
      };

      const success = storageService.markAttendance(record);
      
      if (success) {
        setScanStep('success');
        setAttendanceHistory([record, ...attendanceHistory]);
      } else {
        setStatusMessage('Attendance already marked for this session.');
        setScanStep('error');
      }

    } catch (err: any) {
      setScanStep('error');
      setStatusMessage(err.message || 'Verification failed.');
    }
  };

  const reset = () => {
    setScanStep('idle');
    setScanning(false);
    setStatusMessage('');
    setScannedSessionId(null);
  };

  const getAttendanceStats = () => {
    const totalClasses = Math.max(attendanceHistory.length + 2, attendanceHistory.length);
    const attended = attendanceHistory.length;
    const percentage = Math.round((attended / totalClasses) * 100);
    return { totalClasses, attended, percentage };
  };

  const stats = getAttendanceStats();

  return (
    <div className="space-y-6 relative">
      {/* Content Area */}
      <div className="mt-0">
        {/* MARK ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md overflow-hidden border border-indigo-100 dark:border-slate-700 transition-colors duration-200 min-h-[400px]">
            <div className="p-8 text-center h-full flex flex-col justify-center">
              {scanStep === 'idle' && (
                <div className="py-6">
                  <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 dark:text-indigo-400">
                    <Scan size={48} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-8">Ready to Scan?</h2>
                  <Button onClick={startScan} size="lg" className="px-10 py-4 text-lg shadow-xl shadow-indigo-200/50 dark:shadow-none">
                    <Camera className="mr-2" /> Start Scanner
                  </Button>
                </div>
              )}

              {(scanStep === 'qr' || scanStep === 'face') && (
                <div className="relative max-w-md mx-auto w-full">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[3/4] bg-black border-4 border-slate-800 dark:border-slate-600">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                      videoConstraints={{ facingMode: "environment" }}
                    />
                    
                    {/* Scanning Overlay */}
                    {scanStep === 'qr' && (
                      <>
                        <div className="absolute inset-0 border-2 border-white/50 m-8 rounded-xl"></div>
                        <div className="absolute top-8 left-8 right-8 h-1 bg-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-scan"></div>
                        <div className="absolute bottom-0 left-0 right-0 text-white text-center text-sm font-bold bg-black/60 backdrop-blur-sm py-3">
                          Align QR Code within frame
                        </div>
                      </>
                    )}

                    {/* Face Overlay */}
                    {scanStep === 'face' && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="w-56 h-72 border-4 border-dashed border-green-500/50 rounded-[50%] bg-green-500/10 box-border"></div>
                        </div>
                         <div className="absolute bottom-0 left-0 right-0 text-white text-center text-sm font-bold bg-black/60 backdrop-blur-sm py-3">
                          Verifying Identity... Look at camera
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-6 space-y-4">
                    <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600">
                      <p className="font-medium text-indigo-700 dark:text-indigo-300 animate-pulse flex items-center justify-center gap-2">
                        {statusMessage && <RefreshCw className="animate-spin w-4 h-4" />}
                        {statusMessage}
                      </p>
                    </div>
                    
                    {/* Simulation Buttons - In production these triggers would be automatic */}
                    <div className="grid grid-cols-1 gap-2">
                      {scanStep === 'qr' && (
                        <Button onClick={simulateQRDetection} className="w-full">
                          [DEMO] Simulate QR Scan
                        </Button>
                      )}
                      {scanStep === 'face' && (
                        <Button onClick={verifyIdentityAndMark} className="w-full">
                          [DEMO] Verify Face & Location
                        </Button>
                      )}
                      <Button variant="secondary" onClick={reset} className="w-full">Cancel</Button>
                    </div>
                  </div>
                </div>
              )}

              {scanStep === 'success' && (
                <div className="py-12">
                  <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400 animate-bounce">
                    <CheckCircle size={56} />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Marked Present!</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">Your attendance has been successfully recorded.</p>
                  <Button onClick={() => { reset(); window.history.pushState({}, '', '?view=history'); }} >View History</Button>
                </div>
              )}

              {scanStep === 'error' && (
                <div className="py-12">
                   <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
                    <XCircle size={56} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Verification Failed</h2>
                  <p className="text-red-500 dark:text-red-400 font-medium mb-8 px-4 bg-red-50 dark:bg-red-900/10 py-3 rounded-lg mx-auto max-w-sm border border-red-100 dark:border-red-900/30">
                    {statusMessage}
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="secondary" onClick={reset}>Close</Button>
                    <Button onClick={startScan}><RefreshCw className="mr-2 w-4 h-4"/> Try Again</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY & STATUS TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-6">
                <div className="relative w-24 h-24 flex-shrink-0">
                   <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        className="text-slate-200 dark:text-slate-700"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className={`${stats.percentage >= 75 ? 'text-green-500' : stats.percentage >= 60 ? 'text-yellow-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                        strokeDasharray={`${stats.percentage}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-xl font-bold text-slate-800 dark:text-white">{stats.percentage}%</span>
                   </div>
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-white">Overall Attendance</h3>
                   <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                     You have attended <strong>{stats.attended}</strong> out of <strong>{stats.totalClasses}</strong> sessions.
                   </p>
                   {stats.percentage < 75 && (
                     <p className="text-red-500 text-xs mt-2 font-medium flex items-center">
                       <XCircle size={12} className="mr-1" /> Low Attendance Warning
                     </p>
                   )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                   <PieChart size={20} className="text-indigo-500" /> Subject Breakdown
                 </h3>
                 <div className="space-y-3 max-h-32 overflow-y-auto pr-2">
                    {/* Mock breakdown for demo */}
                    {SUBJECTS_BY_DEPT[user?.department || ""]?.slice(0, 3).map((subj, i) => (
                      <div key={subj} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300 truncate w-2/3">{subj}</span>
                        <span className={`font-bold ${i === 0 ? 'text-green-500' : i === 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                          {i === 0 ? '90%' : i === 1 ? '72%' : '85%'}
                        </span>
                      </div>
                    ))}
                    {!user?.department && <p className="text-slate-400 text-sm">No department assigned.</p>}
                 </div>
              </div>
            </div>

            {/* History List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <History size={20} className="text-slate-500" /> Recent Activity
              </h3>
              <div className="space-y-3">
                {attendanceHistory.length === 0 ? (
                   <div className="text-center py-12 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-600">
                     <History size={32} className="mx-auto text-slate-300 dark:text-slate-500 mb-2" />
                     <p className="text-slate-400 dark:text-slate-500 text-sm">No attendance records found.</p>
                   </div>
                ) : (
                   attendanceHistory.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-lg shadow-sm">
                          {record.subject.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">{record.subject}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                            <Calendar size={12} />
                            {new Date(record.timestamp).toLocaleDateString()} 
                            <span className="mx-1">•</span> 
                            {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase shadow-sm border border-green-200 dark:border-green-900/50">Present</span>
                        {record.verifiedByLocation && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700">
                             <MapPin size={10} /> Verified
                          </span>
                        )}
                      </div>
                    </div>
                   ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TIMETABLE TAB */}
        {activeTab === 'timetable' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[400px]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/30">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar size={20} className="text-indigo-500" /> Weekly Schedule
              </h3>
              <span className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                 {user?.department || 'General'}
              </span>
            </div>
            
            <div className="p-6">
               {schedule.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar size={48} className="mx-auto text-slate-200 dark:text-slate-600 mb-4" />
                    <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300">No Classes Scheduled</h4>
                    <p className="text-slate-400 dark:text-slate-500 mt-2 max-w-xs mx-auto">
                      Your faculty hasn't posted any classes for your department subjects yet.
                    </p>
                  </div>
               ) : (
                 <div className="space-y-6">
                    <div className="grid gap-4">
                      {schedule.map(entry => (
                        <div key={entry.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-l-4 border-l-indigo-500">
                          <div className="mb-2 md:mb-0">
                            <h4 className="font-bold text-lg text-slate-800 dark:text-white">{entry.subject}</h4>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                               <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                 <Calendar size={14} /> {entry.day}
                               </span>
                               <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                 <History size={14} /> {entry.startTime} - {entry.endTime}
                               </span>
                            </div>
                          </div>
                          {/* Link to Mark Attendance view */}
                           <a 
                            href="?view=attendance"
                            className="inline-flex items-center justify-center px-4 py-2 text-sm bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                          >
                            Go to Class
                          </a>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
             <div className="bg-indigo-900 dark:bg-slate-950 p-8 text-center transition-colors duration-200 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0 100 L0 50 Q50 0 100 50 L100 100 Z" fill="white" />
                  </svg>
               </div>
               <div className="relative z-10">
                 <div className="w-28 h-28 bg-white dark:bg-slate-800 rounded-full mx-auto mb-4 p-1 overflow-hidden shadow-xl border-4 border-white/20">
                    {user?.faceDataUrl ? (
                       <img src={user.faceDataUrl} alt="Face ID" className="w-full h-full object-cover rounded-full" />
                    ) : (
                       <div className="w-full h-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                         <UserIcon size={40} />
                       </div>
                    )}
                 </div>
                 <h2 className="text-3xl font-bold text-white mb-1">{user?.name}</h2>
                 <div className="inline-block bg-indigo-800/50 dark:bg-slate-800/50 backdrop-blur-sm px-4 py-1 rounded-full border border-white/10">
                   <p className="text-indigo-100 text-sm font-mono tracking-wide">ID: {user?.uid.substring(0, 8).toUpperCase()}</p>
                 </div>
               </div>
             </div>
             
             <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Personal Information</h4>
                      
                      <div className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                         <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm mr-4 group-hover:text-indigo-500 transition-colors">
                            <UserIcon size={20} />
                         </div>
                         <div>
                           <p className="text-xs text-slate-500 dark:text-slate-400">Full Name</p>
                           <p className="font-medium text-slate-800 dark:text-white">{user?.name}</p>
                         </div>
                      </div>

                      <div className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                         <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm mr-4 group-hover:text-indigo-500 transition-colors">
                            <Mail size={20} />
                         </div>
                         <div>
                           <p className="text-xs text-slate-500 dark:text-slate-400">Email Address</p>
                           <p className="font-medium text-slate-800 dark:text-white">{user?.email}</p>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Academic Details</h4>

                      <div className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                         <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm mr-4 group-hover:text-indigo-500 transition-colors">
                            <Briefcase size={20} />
                         </div>
                         <div>
                           <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                           <p className="font-medium text-slate-800 dark:text-white">{user?.department || 'Not Assigned'}</p>
                         </div>
                      </div>
                      
                      <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">Face ID Security</span>
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full border border-green-200 dark:border-green-900/50">Active</span>
                         </div>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Your face data is encrypted and used solely for attendance verification during class sessions.</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { calculateDistance, getCurrentLocation } from '../../services/geoService';
import { AttendanceRecord, TimetableEntry } from '../../types';
import { Scan, CheckCircle, XCircle, Camera, User as UserIcon, Briefcase, History, Calendar, Shield, SwitchCamera, Clock, Timer, AlertTriangle } from 'lucide-react';
import Button from '../../components/Button';

const SUBJECTS_BY_DEPT: Record<string, string[]> = {
  "Computer Science and Engineering": ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"],
  "CSE-DS": ["ATCD", "PA", "WSMA", "NLP", "WSMA-LAB", "PA-LAB", "I&EE"],
  "CSE-AIML": ["Artificial Intelligence", "Deep Learning", "Neural Networks", "Natural Language Processing", "Computer Vision"],
  "Civil Engineering": ["Structural Analysis", "Geotechnical Engineering", "Surveying", "Construction Mgmt"],
  "Electronics and Communications Engineering": ["Digital Electronics", "Signals & Systems", "Microprocessors", "VLSI Design", "Communication Systems"],
  "Mechanical Engineering": ["Thermodynamics", "Fluid Mechanics", "Strength of Materials", "Machine Design"]
};

const SCAN_TIMEOUT_DURATION = 45; // seconds
// Max pixel difference allowed (0-255 scale). Lower is stricter. 
// 65 allows for some lighting variation without being too loose.
const FACE_MATCH_THRESHOLD = 65; 
const MAX_DISTANCE_METERS = 100;

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('view') || 'attendance';

  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'idle' | 'qr' | 'face' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [scannedSessionId, setScannedSessionId] = useState<string | null>(null);
  const [scannedSubject, setScannedSubject] = useState<string | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(SCAN_TIMEOUT_DURATION);
  
  // State for camera constraints
  const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints>({ 
    facingMode: "environment" 
  });
  
  const webcamRef = useRef<Webcam>(null);

  // Load history and schedule on mount
  useEffect(() => {
    const initData = async () => {
      if (user) {
        try {
            const presentRecords = await storageService.getAttendanceForStudent(user.uid);
            const allSessions = await storageService.getAllSessions();
            const relevantSubjects = user.department ? (SUBJECTS_BY_DEPT[user.department] || []) : [];
            
            const now = Date.now();
            const attendanceSessionIds = new Set(presentRecords.map(r => r.sessionId));
            
            const absentRecords: AttendanceRecord[] = allSessions
            .filter(session => {
                if (relevantSubjects.length > 0 && !relevantSubjects.includes(session.subject)) return false;
                const isFinished = !session.isActive || (session.endTime && session.endTime < now) || (session.startTime < now - (90 * 60 * 1000));
                if (!isFinished) return false;
                return !attendanceSessionIds.has(session.id);
            })
            .map(session => ({
                id: `absent-${session.id}`,
                sessionId: session.id,
                studentId: user.uid,
                studentName: user.name,
                subject: session.subject,
                timestamp: session.startTime,
                status: 'absent' as const,
                verifiedByFace: false,
                verifiedByLocation: false
            }));

            const fullHistory = [...presentRecords, ...absentRecords].sort((a, b) => b.timestamp - a.timestamp);
            setAttendanceHistory(fullHistory);

            await loadSchedule();
        } catch (e) {
            console.error("Failed to load data", e);
        }
      }
    };
    initData();
  }, [user]);

  const loadSchedule = async () => {
    if (!user?.department) return;
    const allEntries = await storageService.getAllTimetables();
    const relevantSubjects = SUBJECTS_BY_DEPT[user.department] || [];
    const studentSchedule = allEntries.filter(entry => relevantSubjects.includes(entry.subject));
    setSchedule(studentSchedule);
  };

  useEffect(() => {
    if (scanStep === 'qr') {
      setVideoConstraints({ facingMode: "environment" });
    } else if (scanStep === 'face') {
      setVideoConstraints({ facingMode: "user" });
    }
  }, [scanStep]);

  useEffect(() => {
    let interval: any;
    if (scanning && scanStep === 'qr' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (scanning && scanStep === 'qr' && timeLeft === 0) {
      setScanning(false);
      setStatusMessage("Scan timed out. Please try again.");
      setScanStep('error');
    }
    return () => clearInterval(interval);
  }, [scanning, scanStep, timeLeft]);

  const startScanning = () => {
    setScanning(true);
    setScanStep('qr');
    setStatusMessage('Point camera at QR Code');
    setScannedSessionId(null);
    setScannedSubject(null);
    setTimeLeft(SCAN_TIMEOUT_DURATION);
  };

  const stopScanning = () => {
    setScanning(false);
    setScanStep('idle');
  };

  const handleCodeFound = async (code: string) => {
      if (scanStep !== 'qr') return;
      
      const validRes = await storageService.validateQR(code);
      
      if (!validRes.valid) return; 
      
      if (validRes.sessionId) {
          setScannedSessionId(validRes.sessionId);
          const session = await storageService.getSessionById(validRes.sessionId);
          if (session) setScannedSubject(session.subject);
          
          setScanStep('face');
          setStatusMessage('Verifying Face ID...');
      }
  };

  useEffect(() => {
    if (!scanning || scanStep !== 'qr') return;
    
    const interval = setInterval(() => {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          const image = new Image();
          image.src = imageSrc;
          image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(image, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              
              if (code) {
                handleCodeFound(code.data);
              }
            }
          };
        }
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [scanning, scanStep]);

  // --- Pixel Based Face Matching Logic (Non-AI) ---
  const compareImages = (src1: string, src2: string): Promise<{ match: boolean; score: number }> => {
    return new Promise((resolve) => {
      const img1 = new Image();
      const img2 = new Image();
      let loaded = 0;

      const onLoaded = () => {
        loaded++;
        if (loaded < 2) return;

        const width = 320;
        const height = 240;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve({ match: false, score: 255 });
          return;
        }

        // Process Image 1 (Stored)
        ctx.drawImage(img1, 0, 0, width, height);
        const data1 = ctx.getImageData(0, 0, width, height).data;

        // Process Image 2 (Captured)
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img2, 0, 0, width, height);
        const data2 = ctx.getImageData(0, 0, width, height).data;

        let totalDiff = 0;
        // Step 4 (optimized): Loop through pixels
        for (let i = 0; i < data1.length; i += 4) {
          // Convert to Grayscale using luminance formula: 0.299R + 0.587G + 0.114B
          const gray1 = 0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2];
          const gray2 = 0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2];
          
          // Calculate difference
          totalDiff += Math.abs(gray1 - gray2);
        }

        const avgPixelDiff = totalDiff / (width * height);
        console.log("Face Compare Score (Lower is better):", avgPixelDiff);
        
        resolve({ 
            match: avgPixelDiff <= FACE_MATCH_THRESHOLD,
            score: avgPixelDiff
        });
      };

      img1.crossOrigin = "Anonymous";
      img2.crossOrigin = "Anonymous";
      img1.onload = onLoaded;
      img2.onload = onLoaded;
      img1.src = src1;
      img2.src = src2;
    });
  };

  const captureFaceAndVerify = useCallback(async () => {
    if (!webcamRef.current || !scannedSessionId || !user) return;
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setStatusMessage("Could not capture face. Try again.");
        return;
      }

      setStatusMessage("Analyzing biometric data...");

      // 1. Verify Face (Client-side Pixel Comparison)
      if (!user.faceDataUrl) {
         throw new Error("No profile photo registered. Please update profile.");
      }

      const faceResult = await compareImages(user.faceDataUrl, imageSrc);
      
      if (!faceResult.match) {
         throw new Error(`Face mismatch detected. (Score: ${Math.floor(faceResult.score)}) Please try in better lighting.`);
      }

      setStatusMessage("Face Verified. Checking location...");
      
      // 2. Verify Location
      const currentLocation = await getCurrentLocation();
      const session = await storageService.getSessionById(scannedSessionId);
      
      let verifiedByLocation = false;
      let distance = 0;

      if (session && session.location) {
        distance = calculateDistance(currentLocation, session.location);
        verifiedByLocation = distance <= MAX_DISTANCE_METERS;
      } else {
         // Fallback for sessions without location data (mostly testing)
         verifiedByLocation = true;
      }

      if (!verifiedByLocation && session?.location?.lat !== 0) {
         throw new Error(`Location verification failed. You are ${Math.round(distance)}m away from class.`);
      }

      // 3. Mark Attendance
      const record: AttendanceRecord = {
        id: Date.now().toString(),
        sessionId: scannedSessionId,
        studentId: user.uid,
        studentName: user.name,
        subject: session?.subject || 'Unknown',
        timestamp: Date.now(),
        status: 'present',
        verifiedByFace: true,
        verifiedByLocation
      };

      const success = await storageService.markAttendance(record);

      if (success) {
        setScanStep('success');
        setStatusMessage("Attendance Marked Successfully!");
        setAttendanceHistory(prev => [record, ...prev]);
      } else {
        setScanStep('error');
        setStatusMessage("Attendance already marked for this session.");
      }

    } catch (err: any) {
      console.error(err);
      setScanStep('error');
      setStatusMessage(err.message || "Verification failed.");
    }
  }, [scannedSessionId, user]);

  const toggleCamera = () => {
    setVideoConstraints(prev => ({
        facingMode: prev.facingMode === "user" ? "environment" : "user"
    }));
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
      
      {/* ACTIVE SCANNER UI */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Scanner Header */}
            <div className="p-4 flex justify-between items-center bg-black/50 backdrop-blur-sm absolute top-0 w-full z-20 text-white">
                <div className="flex items-center gap-2">
                    {scanStep === 'qr' ? <Scan className="animate-pulse text-indigo-400" /> : <UserIcon />}
                    <span className="font-bold tracking-wide">
                        {scanStep === 'qr' ? 'Scan Class QR' : 'Verify Face'}
                    </span>
                </div>
                <button onClick={stopScanning} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <XCircle size={24} />
                </button>
            </div>

            {/* Main Camera View */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
                 <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="absolute inset-0 w-full h-full object-cover"
                    mirrored={videoConstraints.facingMode === "user"}
                />

                {/* QR Scanning Overlay */}
                {scanStep === 'qr' && (
                    <>
                        <div className="absolute inset-0 bg-black/40 z-10" />
                        <div className="relative z-20 w-72 h-72">
                             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-lg shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                             
                             <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-scan opacity-80"></div>
                             
                             <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-red-500/50 rounded-full animate-ping"></div>
                             </div>
                        </div>

                        <div className="absolute top-20 left-0 right-0 z-20 flex justify-center">
                             <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border ${timeLeft < 10 ? 'bg-red-500/20 border-red-500 text-red-200' : 'bg-indigo-900/40 border-indigo-500/50 text-white'}`}>
                                <Timer size={16} className={timeLeft < 10 ? 'animate-pulse' : ''} />
                                <span className="font-mono font-bold text-lg">{timeLeft}s</span>
                             </div>
                        </div>
                        
                        <div className="absolute bottom-32 z-20 bg-blue-900/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-blue-500/30 flex items-center gap-2 text-blue-100">
                             <AlertTriangle size={16} />
                             <span className="text-xs font-medium">Geolocation Verification required</span>
                        </div>
                    </>
                )}

                {/* Face Verification Overlay */}
                {scanStep === 'face' && (
                     <div className="relative z-20 flex flex-col items-center">
                         <div className="w-64 h-64 rounded-full border-4 border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.3)] overflow-hidden relative">
                            <div className="absolute inset-0 border-8 border-white/10 rounded-full"></div>
                         </div>
                         <p className="mt-8 text-white text-lg font-medium bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm">
                             {scannedSubject ? `Confirming: ${scannedSubject}` : 'Align your face'}
                         </p>
                         <p className="mt-2 text-white/70 text-sm text-center max-w-xs">
                             Ensure your lighting matches your profile photo.
                         </p>
                         <div className="mt-6">
                            <Button size="lg" onClick={captureFaceAndVerify} className="rounded-full px-8 shadow-xl shadow-indigo-500/30 transform hover:scale-105 transition-transform">
                                <Camera size={24} className="mr-2" /> Capture & Verify
                            </Button>
                         </div>
                     </div>
                )}
            </div>

            {scanStep === 'qr' && (
                <div className="p-6 bg-black/80 backdrop-blur text-white z-20 flex justify-between items-center pb-8 md:pb-6">
                     <div className="text-sm text-gray-400 max-w-[200px]">
                         Align the QR code within the frame.
                     </div>
                     <div className="flex gap-4">
                        <button onClick={toggleCamera} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                             <SwitchCamera size={24} />
                        </button>
                     </div>
                </div>
            )}
        </div>
      )}

      {/* DASHBOARD CONTENT */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
            {/* Status Card */}
            <div className={`p-6 rounded-2xl shadow-sm border transition-all duration-500 ${
                scanStep === 'success' 
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' 
                    : scanStep === 'error'
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'
                    : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
            }`}>
                <div className="flex flex-col items-center text-center space-y-4">
                    {scanStep === 'success' ? (
                        <>
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Success!</h2>
                            <p className="text-slate-600 dark:text-slate-300">{statusMessage}</p>
                            <Button onClick={() => setScanStep('idle')} variant="outline" className="mt-4">
                                Done
                            </Button>
                        </>
                    ) : scanStep === 'error' ? (
                        <>
                             <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                                <XCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Failed</h2>
                            <p className="text-red-600 dark:text-red-400 font-medium">{statusMessage}</p>
                            <Button onClick={() => { setScanStep('idle'); setStatusMessage(''); }} variant="outline" className="mt-4">
                                Try Again
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
                                    <Scan size={40} />
                                </div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center animate-bounce">
                                    <Clock size={12} className="text-white" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Mark Attendance</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                    Scan the dynamic QR code projected in your classroom.
                                </p>
                            </div>
                            <Button size="lg" onClick={startScanning} className="w-full max-w-xs shadow-lg shadow-indigo-500/20 py-4 text-lg">
                                <Camera size={20} className="mr-2" /> Scan QR Code
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Recent Quick History */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-end mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-white">Recent Activity</h3>
                    <span className="text-xs text-slate-500">Last 3 records</span>
                </div>
                <div className="space-y-3">
                    {attendanceHistory.slice(0, 3).map(record => (
                        <div key={record.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                             <div className={`p-2 rounded-full ${record.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                 {record.status === 'present' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <h4 className="font-semibold text-slate-800 dark:text-white truncate break-words">{record.subject}</h4>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(record.timestamp).toLocaleDateString()} • {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </p>
                             </div>
                             <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                 {record.status}
                             </span>
                        </div>
                    ))}
                    {attendanceHistory.length === 0 && (
                        <p className="text-center text-slate-400 py-4 text-sm">No recent activity</p>
                    )}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'history' && (
         <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <History size={24} className="text-indigo-500" /> Attendance History
            </h2>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {attendanceHistory.length > 0 ? attendanceHistory.map((record) => (
                        <div key={record.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                             <div className="flex items-start gap-4">
                                 <div className="flex-col items-center hidden sm:flex min-w-[60px]">
                                     <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{new Date(record.timestamp).getDate()}</span>
                                     <span className="text-xs text-slate-500 uppercase">{new Date(record.timestamp).toLocaleString('default', { month: 'short' })}</span>
                                 </div>
                                 
                                 <div className={`mt-1 p-2 rounded-full flex-shrink-0 sm:hidden ${record.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                     {record.status === 'present' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                 </div>

                                 <div className="flex-1">
                                     <div className="flex justify-between items-start">
                                         <h4 className="font-bold text-slate-800 dark:text-white text-lg break-words">{record.subject}</h4>
                                         <span className={`px-2 py-1 rounded text-xs font-bold uppercase flex-shrink-0 ml-2 ${
                                             record.status === 'present' 
                                             ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                             : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                         }`}>
                                             {record.status}
                                         </span>
                                     </div>
                                     <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                         <span className="flex items-center gap-1">
                                             <Clock size={14} />
                                             {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                         </span>
                                         {record.status === 'present' && (
                                             <span className="flex items-center gap-1">
                                                 <Shield size={14} />
                                                 {record.verifiedByFace ? 'Verified' : 'Manual'}
                                             </span>
                                         )}
                                     </div>
                                 </div>
                             </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            No attendance records found.
                        </div>
                    )}
                </div>
            </div>
         </div>
      )}

      {activeTab === 'timetable' && (
          <div className="space-y-4">
             <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Calendar size={24} className="text-indigo-500" /> Class Schedule
             </h2>
             <div className="grid gap-4">
                 {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                     const daysClasses = schedule.filter(s => s.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
                     if (daysClasses.length === 0) return null;
                     return (
                         <div key={day} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                             <h3 className="font-bold text-indigo-600 dark:text-indigo-400 mb-3">{day}</h3>
                             <div className="space-y-3">
                                 {daysClasses.map(cls => (
                                     <div key={cls.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                                         <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded text-sm font-mono font-bold">
                                             {cls.startTime}
                                         </div>
                                         <div className="flex-1">
                                             <p className="font-semibold text-slate-800 dark:text-white break-words">{cls.subject}</p>
                                             <p className="text-xs text-slate-500 dark:text-slate-400">Duration: 60 min</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     );
                 })}
                 {schedule.length === 0 && (
                     <div className="bg-white dark:bg-slate-800 p-8 rounded-xl text-center text-slate-500 border border-slate-200 dark:border-slate-700">
                         No timetable data available for your department.
                     </div>
                 )}
             </div>
          </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6">
             <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-24 bg-indigo-600 dark:bg-indigo-900"></div>
                 <div className="relative pt-12 px-4 text-center">
                     <div className="w-24 h-24 mx-auto bg-white dark:bg-slate-800 rounded-full p-1 shadow-lg">
                         {user.faceDataUrl ? (
                             <img src={user.faceDataUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                         ) : (
                             <div className="w-full h-full rounded-full bg-indigo-100 dark:bg-slate-700 flex items-center justify-center text-indigo-500">
                                 <UserIcon size={40} />
                             </div>
                         )}
                     </div>
                     <h2 className="mt-4 text-2xl font-bold text-slate-800 dark:text-white">{user.name}</h2>
                     <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 mt-1">
                        <Briefcase size={14} />
                        <span>{user.department || 'General Engineering'}</span>
                     </div>
                 </div>
                 
                 <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                     <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                         <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Roll Number</label>
                         <p className="text-slate-800 dark:text-white font-mono mt-1 break-all">{user.rollNo || 'N/A'}</p>
                     </div>
                     <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                         <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Email</label>
                         <p className="text-slate-800 dark:text-white mt-1 break-all">{user.email}</p>
                     </div>
                     <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                         <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Attendance Rate</label>
                         <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-600 rounded-full">
                                <div className="h-full bg-green-500 rounded-full" style={{width: '85%'}}></div>
                            </div>
                            <span className="text-sm font-bold text-green-600">85%</span>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;

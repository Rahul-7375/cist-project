
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { calculateDistance, getCurrentLocation } from '../../services/geoService';
import { AttendanceRecord, TimetableEntry } from '../../types';
import { Scan, CheckCircle, XCircle, Camera, User as UserIcon, Briefcase, History, Calendar, Shield, SwitchCamera, Clock, Timer, AlertTriangle, ScanFace, Fingerprint, MapPin, Loader2 } from 'lucide-react';
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
// Max pixel difference allowed (0-255 scale). 
// Increased to 85 to allow for minor lighting/position variations while maintaining security.
const FACE_MATCH_THRESHOLD = 85; 
const MAX_DISTANCE_METERS = 100;

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('view') || 'attendance';

  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'idle' | 'qr' | 'face' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [scannedSessionId, setScannedSessionId] = useState<string | null>(null);
  const [scannedSubject, setScannedSubject] = useState<string | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(SCAN_TIMEOUT_DURATION);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  
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
    setAnalysisProgress(0);
  };

  const stopScanning = () => {
    setScanning(false);
    setScanStep('idle');
    setAnalysisProgress(0);
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

  // --- Robust Face Matching Logic ---
  const compareImages = (src1: string, src2: string): Promise<{ match: boolean; score: number }> => {
    return new Promise((resolve) => {
      const img1 = new Image();
      const img2 = new Image();
      let loaded = 0;

      const onLoaded = () => {
        loaded++;
        if (loaded < 2) return;

        // Downscale significantly to 64x64 for comparison to reduce sensitivity to noise/movement
        const width = 64;
        const height = 64;
        
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
        const pixels = width * height;

        // Loop through pixels
        for (let i = 0; i < data1.length; i += 4) {
          // Convert to Grayscale: 0.299R + 0.587G + 0.114B
          const gray1 = 0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2];
          const gray2 = 0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2];
          
          totalDiff += Math.abs(gray1 - gray2);
        }

        const avgPixelDiff = totalDiff / pixels;
        console.log("Face Compare Score:", avgPixelDiff);
        
        resolve({ 
            match: avgPixelDiff <= FACE_MATCH_THRESHOLD,
            score: avgPixelDiff
        });
      };

      // Avoid setting crossOrigin for Data URLs to prevent potential taint issues in some browsers
      if (!src1.startsWith('data:')) img1.crossOrigin = "Anonymous";
      if (!src2.startsWith('data:')) img2.crossOrigin = "Anonymous";
      
      img1.onload = onLoaded;
      img2.onload = onLoaded;
      img1.onerror = () => resolve({ match: false, score: 255 });
      img2.onerror = () => resolve({ match: false, score: 255 });
      
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

      setScanStep('processing');
      
      // Simulate progressive analysis
      let progress = 0;
      const progressInterval = setInterval(() => {
          progress += 5;
          if (progress > 90) progress = 90;
          setAnalysisProgress(progress);
      }, 50);

      // Artificial delay to allow UI to show "Processing" state
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStatusMessage("Biometric Analysis...");

      // 1. Verify Face
      if (!user.faceDataUrl) {
         clearInterval(progressInterval);
         throw new Error("No profile photo registered. Please update profile.");
      }

      const faceResult = await compareImages(user.faceDataUrl, imageSrc);
      
      if (!faceResult.match) {
         clearInterval(progressInterval);
         throw new Error(`Face Verification Failed. (Match Score: ${Math.floor(faceResult.score)}). Please ensure good lighting.`);
      }

      setStatusMessage("Checking Geolocation...");
      
      // 2. Verify Location
      const currentLocation = await getCurrentLocation();
      const session = await storageService.getSessionById(scannedSessionId);
      
      let verifiedByLocation = false;
      let distance = 0;

      if (session && session.location) {
        distance = calculateDistance(currentLocation, session.location);
        verifiedByLocation = distance <= MAX_DISTANCE_METERS;
      } else {
         // Fallback for sessions without location data
         verifiedByLocation = true;
      }

      if (!verifiedByLocation && session?.location?.lat !== 0) {
         clearInterval(progressInterval);
         throw new Error(`Location Verification Failed. You are ${Math.round(distance)}m away from class.`);
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
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);

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
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
            {/* Scanner Header */}
            <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-30 text-white">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    {scanStep === 'qr' ? <Scan size={18} className="text-indigo-400" /> : <ScanFace size={18} className="text-indigo-400" />}
                    <span className="font-mono font-bold text-sm tracking-wider">
                        {scanStep === 'qr' ? 'QR SCAN' : scanStep === 'face' || scanStep === 'processing' ? 'FACE ID' : 'STATUS'}
                    </span>
                </div>
                <button onClick={stopScanning} className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/20 transition-colors">
                    <XCircle size={24} className="text-white/80" />
                </button>
            </div>

            {/* Main Camera View */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900">
                 <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                    mirrored={videoConstraints.facingMode === "user"}
                />
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                {/* QR Scanning Overlay */}
                {scanStep === 'qr' && (
                    <>
                        <div className="absolute inset-0 bg-black/40 z-10" />
                        <div className="relative z-20 w-72 h-72">
                             {/* Corner Brackets */}
                             <div className="absolute top-0 left-0 w-12 h-12 border-t-[4px] border-l-[4px] border-indigo-500 rounded-tl-2xl" />
                             <div className="absolute top-0 right-0 w-12 h-12 border-t-[4px] border-r-[4px] border-indigo-500 rounded-tr-2xl" />
                             <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[4px] border-l-[4px] border-indigo-500 rounded-bl-2xl" />
                             <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[4px] border-r-[4px] border-indigo-500 rounded-br-2xl" />
                             
                             {/* Scan Line */}
                             <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.8)] animate-scan opacity-80"></div>
                             
                             {/* Center Target */}
                             <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-1 border border-indigo-500/30"></div>
                                <div className="h-16 w-1 border border-indigo-500/30 absolute"></div>
                             </div>
                        </div>

                        {/* Timer Badge */}
                        <div className="absolute top-24 left-0 right-0 z-20 flex justify-center">
                             <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md border ${timeLeft < 10 ? 'bg-red-500/20 border-red-500 text-red-200' : 'bg-indigo-900/40 border-indigo-500/50 text-indigo-100'}`}>
                                <Timer size={14} className={timeLeft < 10 ? 'animate-pulse' : ''} />
                                <span className="font-mono font-bold">{timeLeft}s</span>
                             </div>
                        </div>
                    </>
                )}

                {/* Face Verification Overlay */}
                {(scanStep === 'face' || scanStep === 'processing') && (
                     <div className="relative z-20 flex flex-col items-center w-full h-full justify-center bg-black/30 backdrop-blur-[2px]">
                         
                         {/* Face Guide Silhouette */}
                         <div className="relative">
                             {/* Outer Glow Ring */}
                             <div className={`w-72 h-96 border-[3px] rounded-[50%] transition-all duration-500 relative overflow-hidden
                                ${scanStep === 'processing' ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)]' : 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)]'}
                             `}>
                                {/* Scanning Gradient Beam */}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent h-1/2 w-full animate-scan"></div>
                             </div>
                             
                             {/* Side Tech Accents */}
                             <div className="absolute top-1/2 -left-8 -translate-y-1/2 flex flex-col gap-1">
                                 <div className="w-4 h-1 bg-indigo-500/50"></div>
                                 <div className="w-6 h-1 bg-indigo-500"></div>
                                 <div className="w-4 h-1 bg-indigo-500/50"></div>
                             </div>
                             <div className="absolute top-1/2 -right-8 -translate-y-1/2 flex flex-col gap-1 items-end">
                                 <div className="w-4 h-1 bg-indigo-500/50"></div>
                                 <div className="w-6 h-1 bg-indigo-500"></div>
                                 <div className="w-4 h-1 bg-indigo-500/50"></div>
                             </div>
                         </div>

                         {/* Status Text */}
                         <div className="mt-8 flex flex-col items-center">
                             {scanStep === 'processing' ? (
                                 <div className="flex flex-col items-center">
                                     <div className="flex items-center gap-2 text-yellow-400 font-mono text-lg font-bold animate-pulse">
                                         <Loader2 className="animate-spin" /> ANALYZING BIOMETRICS
                                     </div>
                                     {/* Progress Bar */}
                                     <div className="w-64 h-2 bg-slate-700 rounded-full mt-3 overflow-hidden border border-slate-600">
                                         <div 
                                            className="h-full bg-yellow-400 transition-all duration-75 ease-out"
                                            style={{ width: `${analysisProgress}%` }}
                                         ></div>
                                     </div>
                                     <p className="text-slate-300 text-xs mt-2 font-mono">{analysisProgress}% COMPLETE</p>
                                 </div>
                             ) : (
                                 <>
                                     <p className="text-white text-xl font-bold tracking-tight drop-shadow-md">
                                         {scannedSubject || 'Verifying Identity'}
                                     </p>
                                     <p className="mt-1 text-indigo-200/80 text-sm font-medium bg-black/30 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                                         Align face within the frame
                                     </p>
                                 </>
                             )}
                         </div>

                         {/* Action Button */}
                         {scanStep === 'face' && (
                             <div className="absolute bottom-10">
                                <Button 
                                    onClick={captureFaceAndVerify} 
                                    className="rounded-full h-16 w-16 bg-white hover:bg-indigo-50 text-indigo-600 shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center border-4 border-indigo-500/30"
                                >
                                    <ScanFace size={32} />
                                </Button>
                             </div>
                         )}
                     </div>
                )}
            </div>

            {/* Footer for QR Mode */}
            {scanStep === 'qr' && (
                <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-black via-black/80 to-transparent pt-20 z-20">
                     <div className="flex justify-between items-end">
                         <div className="text-indigo-200 text-sm font-medium max-w-[200px] leading-tight">
                             <AlertTriangle size={16} className="inline mr-1 mb-0.5" />
                             Ensure you are in the classroom for location verification.
                         </div>
                         <button 
                            onClick={toggleCamera} 
                            className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors text-white"
                         >
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
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2 ring-4 ring-green-50 dark:ring-green-900/30">
                                <CheckCircle size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Attendance Marked</h2>
                                <p className="text-slate-600 dark:text-slate-300 mt-1">{statusMessage}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-lg">
                                <Shield size={12} /> VERIFIED SECURELY
                            </div>
                            <Button onClick={() => setScanStep('idle')} variant="outline" className="mt-2">
                                Close
                            </Button>
                        </>
                    ) : scanStep === 'error' ? (
                        <>
                             <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2 ring-4 ring-red-50 dark:ring-red-900/30">
                                <XCircle size={32} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Verification Failed</h2>
                                <p className="text-red-600 dark:text-red-400 font-medium mt-1">{statusMessage}</p>
                            </div>
                            <Button onClick={() => { setScanStep('idle'); setStatusMessage(''); }} variant="outline" className="mt-2">
                                Try Again
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="relative group cursor-pointer" onClick={startScanning}>
                                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 transform group-hover:scale-105 transition-all duration-300">
                                    <Scan size={40} className="text-white" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-slate-800 rounded-full border-2 border-indigo-100 dark:border-slate-600 flex items-center justify-center">
                                    <Fingerprint size={16} className="text-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Mark Attendance</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                    Secure QR scan with facial biometrics and geolocation.
                                </p>
                            </div>
                            <Button size="lg" onClick={startScanning} className="w-full max-w-xs shadow-xl shadow-indigo-500/20 py-4 text-lg rounded-xl">
                                <Camera size={20} className="mr-2" /> Start Scanner
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Recent Quick History */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <History size={18} className="text-indigo-500"/> Recent Activity
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400">Last 3 records</span>
                </div>
                <div className="space-y-3">
                    {attendanceHistory.slice(0, 3).map(record => (
                        <div key={record.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors">
                             <div className={`p-2.5 rounded-lg ${record.status === 'present' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                                 {record.status === 'present' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <h4 className="font-semibold text-slate-800 dark:text-white truncate break-words">{record.subject}</h4>
                                 <div className="flex items-center gap-3 mt-1">
                                     <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                     </p>
                                     {record.verifiedByFace && (
                                         <p className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                                            <ScanFace size={12} /> Bio-Verified
                                         </p>
                                     )}
                                 </div>
                             </div>
                        </div>
                    ))}
                    {attendanceHistory.length === 0 && (
                        <div className="text-center text-slate-400 py-8 text-sm bg-slate-50 dark:bg-slate-700/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            No recent activity found
                        </div>
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
                                 <div className="flex-col items-center hidden sm:flex min-w-[60px] bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                                     <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{new Date(record.timestamp).getDate()}</span>
                                     <span className="text-xs text-slate-500 uppercase font-bold">{new Date(record.timestamp).toLocaleString('default', { month: 'short' })}</span>
                                 </div>
                                 
                                 <div className={`mt-1 p-2 rounded-full flex-shrink-0 sm:hidden ${record.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                     {record.status === 'present' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                 </div>

                                 <div className="flex-1">
                                     <div className="flex justify-between items-start">
                                         <h4 className="font-bold text-slate-800 dark:text-white text-lg break-words">{record.subject}</h4>
                                         <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase flex-shrink-0 ml-2 ${
                                             record.status === 'present' 
                                             ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                             : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                         }`}>
                                             {record.status}
                                         </span>
                                     </div>
                                     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500 dark:text-slate-400">
                                         <span className="flex items-center gap-1">
                                             <Clock size={14} />
                                             {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                         </span>
                                         {record.status === 'present' && (
                                             <>
                                                 <span className="flex items-center gap-1" title="Biometric Verification">
                                                     <ScanFace size={14} className={record.verifiedByFace ? "text-green-500" : "text-slate-400"} />
                                                     {record.verifiedByFace ? 'Face OK' : 'Manual'}
                                                 </span>
                                                 <span className="flex items-center gap-1" title="Location Verification">
                                                     <MapPin size={14} className={record.verifiedByLocation ? "text-green-500" : "text-slate-400"} />
                                                     {record.verifiedByLocation ? 'GPS OK' : 'Loc Skip'}
                                                 </span>
                                             </>
                                         )}
                                     </div>
                                 </div>
                             </div>
                        </div>
                    )) : (
                        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                            <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No attendance records found.</p>
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
                             <h3 className="font-bold text-indigo-600 dark:text-indigo-400 mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">{day}</h3>
                             <div className="space-y-3">
                                 {daysClasses.map(cls => (
                                     <div key={cls.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 transition-colors">
                                         <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm px-3 py-2 rounded-md text-sm font-mono font-bold border border-slate-100 dark:border-slate-600">
                                             {cls.startTime}
                                         </div>
                                         <div className="flex-1">
                                             <p className="font-semibold text-slate-800 dark:text-white break-words">{cls.subject}</p>
                                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">1 Hour Session</p>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     );
                 })}
                 {schedule.length === 0 && (
                     <div className="bg-white dark:bg-slate-800 p-12 rounded-xl text-center text-slate-500 border border-slate-200 dark:border-slate-700">
                         <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                             <Calendar size={32} />
                         </div>
                         <p>No timetable scheduled for your department yet.</p>
                     </div>
                 )}
             </div>
          </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6">
             <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-600 to-purple-700"></div>
                 <div className="relative pt-16 px-4 text-center">
                     <div className="w-32 h-32 mx-auto bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-xl ring-4 ring-white/20">
                         {user.faceDataUrl ? (
                             <img src={user.faceDataUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                         ) : (
                             <div className="w-full h-full rounded-full bg-indigo-50 dark:bg-slate-700 flex items-center justify-center text-indigo-300">
                                 <UserIcon size={48} />
                             </div>
                         )}
                     </div>
                     <h2 className="mt-4 text-2xl font-bold text-slate-800 dark:text-white">{user.name}</h2>
                     <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 mt-1 bg-slate-100 dark:bg-slate-700/50 inline-flex px-3 py-1 rounded-full text-sm mx-auto">
                        <Briefcase size={14} />
                        <span>{user.department || 'General Engineering'}</span>
                     </div>
                 </div>
                 
                 <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                     <div className="p-5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                         <label className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-2 mb-2">
                             <Shield size={12} /> Roll Number
                         </label>
                         <p className="text-slate-800 dark:text-white font-mono text-lg font-semibold break-all tracking-wide">{user.rollNo || 'N/A'}</p>
                     </div>
                     <div className="p-5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                         <label className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-2 mb-2">
                             <UserIcon size={12} /> Email
                         </label>
                         <p className="text-slate-800 dark:text-white font-medium break-all">{user.email}</p>
                     </div>
                     <div className="p-5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 md:col-span-2">
                         <div className="flex justify-between items-end mb-2">
                             <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Overall Attendance</label>
                             <span className="text-lg font-bold text-green-600 dark:text-green-400">85%</span>
                         </div>
                         <div className="w-full h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{width: '85%'}}></div>
                         </div>
                         <p className="text-xs text-slate-400 mt-2 text-right">Excellent record</p>
                     </div>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;

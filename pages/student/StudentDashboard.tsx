
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { calculateDistance, getCurrentLocation } from '../../services/geoService';
import { AttendanceRecord, TimetableEntry } from '../../types';
import { Scan, CheckCircle, XCircle, Camera, User as UserIcon, Briefcase, History, Calendar, Shield, SwitchCamera, Clock, Timer, AlertTriangle, ScanFace, Fingerprint, MapPin, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import Button from '../../components/Button';
import { SUBJECTS_BY_DEPT, SYSTEM_CONFIG } from '../../utils/constants';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('view') || 'attendance';

  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'idle' | 'qr' | 'face' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [scannedSessionId, setScannedSessionId] = useState<string | null>(null);
  const [scannedSubject, setScannedSubject] = useState<string | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(SYSTEM_CONFIG.SCAN_TIMEOUT_SECONDS);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  
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
                const isFinished = !session.isActive || (session.endTime && session.endTime < now) || (session.startTime < now - (SYSTEM_CONFIG.SESSION_STALE_MINUTES * 60 * 1000));
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
            refreshLocation();
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

  const refreshLocation = async () => {
      setLocLoading(true);
      try {
          const loc = await getCurrentLocation();
          setUserLocation(loc);
      } catch (error) {
          console.error("Location error:", error);
          alert("Could not refresh location. Please check GPS settings.");
      } finally {
          setLocLoading(false);
      }
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
    setTimeLeft(SYSTEM_CONFIG.SCAN_TIMEOUT_SECONDS);
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

  const compareImages = (src1: string, src2: string): Promise<{ match: boolean; score: number }> => {
    return new Promise((resolve) => {
      const img1 = new Image();
      const img2 = new Image();
      let loaded = 0;

      const onLoaded = () => {
        loaded++;
        if (loaded < 2) return;

        const width = 64;
        const height = 64;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          resolve({ match: false, score: 255 });
          return;
        }

        const getMetrics = (img: HTMLImageElement | HTMLCanvasElement, flip = false) => {
            ctx.clearRect(0, 0, width, height);
            ctx.save();
            if (flip) {
                ctx.translate(width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(img, 0, 0, width, height);
            ctx.restore();
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const gray = new Uint8Array(width * height);
            let totalBrightness = 0;
            
            for (let i = 0; i < width * height; i++) {
                const val = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
                gray[i] = val;
                totalBrightness += val;
            }
            
            return { 
                pixels: gray, 
                avgBrightness: totalBrightness / (width * height) 
            };
        };

        const refData = getMetrics(img1);
        const targetDataNormal = getMetrics(img2, false);
        const targetDataMirrored = getMetrics(img2, true);

        const calculateDiff = (ref: typeof refData, target: typeof refData) => {
             const brightnessShift = ref.avgBrightness - target.avgBrightness;
             let totalDiff = 0;
             
             for(let i = 0; i < ref.pixels.length; i++) {
                 let adjustedVal = target.pixels[i] + brightnessShift;
                 adjustedVal = Math.max(0, Math.min(255, adjustedVal));
                 totalDiff += Math.abs(ref.pixels[i] - adjustedVal);
             }
             return totalDiff / ref.pixels.length;
        };

        const scoreNormal = calculateDiff(refData, targetDataNormal);
        const scoreMirrored = calculateDiff(refData, targetDataMirrored);
        
        const bestScore = Math.min(scoreNormal, scoreMirrored);
        
        resolve({ 
            match: bestScore <= SYSTEM_CONFIG.FACE_MATCH_THRESHOLD,
            score: bestScore
        });
      };

      img1.crossOrigin = "Anonymous";
      img2.crossOrigin = "Anonymous";
      
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
        setStatusMessage("Could not capture frame. Please allow camera access.");
        setScanStep('error');
        return;
      }

      setScanStep('processing');
      setAnalysisProgress(0);
      
      const updateProgress = (val: number) => setAnalysisProgress(val);

      // 1. Start Analysis
      updateProgress(10);
      setStatusMessage("Analyzing biometric data...");
      await new Promise(r => setTimeout(r, 600));

      // 2. Verify Face
      updateProgress(30);
      if (!user.faceDataUrl) {
         throw new Error("Profile photo missing. Please update your profile.");
      }

      const faceResult = await compareImages(user.faceDataUrl, imageSrc);
      
      if (!faceResult.match) {
         updateProgress(0);
         const msg = faceResult.score > 150 
            ? "Face not recognized. Please ensure good lighting." 
            : "Verification failed. Look straight at the camera.";
         throw new Error(msg);
      }

      // 3. Verify Location
      updateProgress(70);
      setStatusMessage("Verifying geolocation...");
      
      const currentLocation = await getCurrentLocation();
      const session = await storageService.getSessionById(scannedSessionId);
      
      let verifiedByLocation = false;
      let distance = 0;

      if (session && session.location && session.location.lat !== 0) {
        distance = calculateDistance(currentLocation, session.location);
        // Handle 0 or NaN gracefully
        if (isNaN(distance)) distance = 0;
        
        verifiedByLocation = distance <= SYSTEM_CONFIG.GPS_RADIUS_METERS;
        console.log(`Location Check: Dist ${distance.toFixed(1)}m, Max ${SYSTEM_CONFIG.GPS_RADIUS_METERS}m`);
      } else {
         verifiedByLocation = true; 
      }

      if (!verifiedByLocation) {
         updateProgress(0);
         throw new Error(`Location Error: You are ${Math.round(distance)}m away (Max ${SYSTEM_CONFIG.GPS_RADIUS_METERS}m). Move closer.`);
      }

      // 4. Mark Attendance
      updateProgress(90);
      setStatusMessage("Finalizing attendance...");
      
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
        updateProgress(100);
        setScanStep('success');
        setStatusMessage("Attendance Marked");
        setAttendanceHistory(prev => [record, ...prev]);
      } else {
        setScanStep('error');
        setStatusMessage("Attendance already marked for this session.");
      }

    } catch (err: any) {
      console.error("Verification Error:", err);
      setScanStep('error');
      setStatusMessage(err.message || "Verification failed. Please try again.");
    }
  }, [scannedSessionId, user]);

  const toggleCamera = () => {
    setVideoConstraints(prev => ({
        facingMode: prev.facingMode === "user" ? "environment" : "user"
    }));
  };

  const resetScanner = () => {
      setScanStep('qr');
      setTimeLeft(SYSTEM_CONFIG.SCAN_TIMEOUT_SECONDS);
      setAnalysisProgress(0);
      setScanning(true);
      setScannedSessionId(null);
      setScannedSubject(null);
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
      
      {/* ACTIVE SCANNER UI */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-300">
            {/* Scanner Header */}
            <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent absolute top-0 w-full z-30 text-white">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    {scanStep === 'qr' ? <Scan size={18} className="text-indigo-400" /> : 
                     scanStep === 'success' ? <CheckCircle size={18} className="text-green-400" /> :
                     scanStep === 'error' ? <AlertTriangle size={18} className="text-red-400" /> :
                     <ScanFace size={18} className="text-indigo-400" />}
                    <span className="font-mono font-bold text-sm tracking-wider">
                        {scanStep === 'qr' ? 'QR SCAN' : 
                         scanStep === 'success' ? 'COMPLETE' :
                         scanStep === 'error' ? 'ERROR' : 'BIOMETRIC'}
                    </span>
                </div>
                <button onClick={stopScanning} className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/20 transition-colors shadow-lg">
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
                    screenshotQuality={0.9}
                />
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                {/* SUCCESS UI - "Attendance Marked" */}
                {scanStep === 'success' && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-in zoom-in duration-300 p-6">
                        <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.6)] mb-8 animate-bounce">
                            <CheckCircle size={64} className="text-white" />
                        </div>
                        <h2 className="text-4xl font-extrabold text-white tracking-tight text-center mb-2">Attendance Marked!</h2>
                        <p className="text-indigo-200 text-xl font-medium text-center mb-12">
                           Success for <span className="text-white font-bold">{scannedSubject}</span>
                        </p>
                        
                        <div className="bg-white/10 rounded-2xl p-6 w-full max-w-sm border border-white/10 mb-8 backdrop-blur-sm">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-white/60">Time</span>
                              <span className="text-white font-mono">{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-white/60">Location</span>
                              <span className="text-green-400 font-bold flex items-center gap-1"><CheckCircle size={14}/> Verified</span>
                           </div>
                        </div>

                        <Button onClick={stopScanning} className="w-full max-w-xs h-14 rounded-full bg-white text-green-700 hover:bg-green-50 font-bold text-lg shadow-2xl transition-transform hover:scale-105">
                            Back to Dashboard
                        </Button>
                    </div>
                )}

                {/* ERROR UI */}
                {scanStep === 'error' && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-in zoom-in duration-300 p-6">
                        <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.5)] mb-6">
                            <XCircle size={48} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Verification Failed</h2>
                        <p className="text-red-200 text-center px-4 mb-8 leading-relaxed">{statusMessage}</p>
                        
                        <div className="flex gap-4 w-full max-w-sm">
                            <Button onClick={stopScanning} variant="secondary" className="flex-1 bg-white/10 text-white hover:bg-white/20 border-0 h-12">
                                Cancel
                            </Button>
                            <Button onClick={resetScanner} className="flex-1 bg-white text-red-600 hover:bg-red-50 h-12">
                                Try Again
                            </Button>
                        </div>
                    </div>
                )}

                {/* QR Scanning Overlay */}
                {scanStep === 'qr' && (
                    <>
                        <div className="absolute inset-0 bg-black/50 z-10" />
                        <div className="relative z-20 w-72 h-72">
                             <div className="absolute top-0 left-0 w-12 h-12 border-t-[4px] border-l-[4px] border-indigo-500 rounded-tl-2xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                             <div className="absolute top-0 right-0 w-12 h-12 border-t-[4px] border-r-[4px] border-indigo-500 rounded-tr-2xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                             <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[4px] border-l-[4px] border-indigo-500 rounded-bl-2xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                             <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[4px] border-r-[4px] border-indigo-500 rounded-br-2xl shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                             
                             <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-400 shadow-[0_0_30px_rgba(99,102,241,1)] animate-scan opacity-90"></div>
                        </div>

                        <div className="absolute top-24 left-0 right-0 z-20 flex justify-center">
                             <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-all ${timeLeft < 10 ? 'bg-red-500/30 border-red-500 text-red-100' : 'bg-indigo-900/50 border-indigo-500/50 text-indigo-100'}`}>
                                <Timer size={14} className={timeLeft < 10 ? 'animate-pulse' : ''} />
                                <span className="font-mono font-bold">{timeLeft}s</span>
                             </div>
                        </div>
                    </>
                )}

                {/* Face Verification Overlay */}
                {(scanStep === 'face' || scanStep === 'processing') && (
                     <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-black/60 via-transparent to-black/60">
                         
                         {/* Face Guide Silhouette */}
                         <div className="relative group">
                             <div className={`w-72 h-96 border-[3px] rounded-[50%] transition-all duration-500 relative overflow-hidden backdrop-blur-[2px]
                                ${scanStep === 'processing' 
                                    ? 'border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.3)]' 
                                    : 'border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.3)]'}
                             `}>
                                <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-1/3 w-full animate-scan ${scanStep === 'processing' ? 'duration-700' : 'duration-1000'}`}></div>
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-30"></div>
                             </div>
                             
                             <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 border border-indigo-500/30 rounded-full text-[10px] font-mono text-indigo-300 backdrop-blur-md">
                                 FACE_ID_VERIFY
                             </div>
                         </div>

                         <div className="mt-10 flex flex-col items-center">
                             {scanStep === 'processing' ? (
                                 <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                                     <div className="flex items-center gap-2 text-yellow-400 font-mono text-lg font-bold">
                                         <Loader2 className="animate-spin" /> 
                                         {analysisProgress < 30 ? 'CAPTURING...' : analysisProgress < 60 ? 'COMPARING...' : 'VERIFYING LOC...'}
                                     </div>
                                     <div className="w-64 h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden border border-slate-700">
                                         <div 
                                            className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] transition-all duration-300 ease-out"
                                            style={{ width: `${analysisProgress}%` }}
                                         ></div>
                                     </div>
                                 </div>
                             ) : (
                                 <>
                                     <h3 className="text-white text-xl font-bold tracking-tight drop-shadow-lg flex items-center gap-2">
                                         {scannedSubject}
                                     </h3>
                                     <div className="mt-3 flex flex-col gap-2 items-center">
                                        <span className="text-indigo-100/90 text-sm font-medium bg-indigo-900/40 px-4 py-1.5 rounded-full backdrop-blur-md border border-indigo-500/30 shadow-lg">
                                            Look directly at camera
                                        </span>
                                     </div>
                                 </>
                             )}
                         </div>

                         {scanStep === 'face' && (
                             <div className="absolute bottom-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                <Button 
                                    onClick={captureFaceAndVerify} 
                                    className="rounded-full h-20 w-20 bg-white hover:bg-indigo-50 text-indigo-600 shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center justify-center border-4 border-indigo-100 transition-all hover:scale-105 active:scale-95"
                                >
                                    <ScanFace size={36} />
                                </Button>
                             </div>
                         )}
                     </div>
                )}
            </div>

            {/* Footer for QR Mode */}
            {scanStep === 'qr' && (
                <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-black via-black/80 to-transparent pt-24 z-20">
                     <div className="flex justify-between items-end">
                         <div className="text-indigo-200 text-sm font-medium max-w-[220px] leading-snug bg-black/40 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                             <AlertTriangle size={14} className="inline mr-1.5 mb-0.5 text-yellow-400" />
                             For verification, you must be physically present in the classroom.
                         </div>
                         <button 
                            onClick={toggleCamera} 
                            className="p-3.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors text-white shadow-lg active:scale-95"
                         >
                             <SwitchCamera size={24} />
                         </button>
                     </div>
                </div>
            )}
        </div>
      )}

      {/* DASHBOARD CONTENT */}
      {!scanning && (
          <div className="space-y-6">
             {activeTab === 'attendance' && (
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="p-6 rounded-2xl shadow-sm border bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="relative group cursor-pointer" onClick={startScanning}>
                                <div className="w-28 h-28 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/30 transform group-hover:scale-105 transition-all duration-300">
                                    <Scan size={48} className="text-white" />
                                </div>
                                <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-white dark:bg-slate-800 rounded-full border-4 border-slate-50 dark:border-slate-900 flex items-center justify-center shadow-sm">
                                    <Fingerprint size={20} className="text-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Check In</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                                    Scan the classroom QR code to mark your attendance securely.
                                </p>
                            </div>
                            <Button size="lg" onClick={startScanning} className="w-full max-w-xs shadow-xl shadow-indigo-500/20 py-4 text-lg rounded-xl transition-transform active:scale-95">
                                <Camera size={20} className="mr-2" /> Start Scanner
                            </Button>
                        </div>

                        {/* Location Status Block */}
                        <div className="w-full mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                                 <div className="flex items-center gap-3">
                                     <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                         <MapPin size={16} />
                                     </div>
                                     <div className="text-left">
                                         <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Current Location</p>
                                         <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                             {locLoading ? 'Updating...' : userLocation ? `${userLocation.lat}, ${userLocation.lng}` : 'Not detected'}
                                         </p>
                                     </div>
                                 </div>
                                 <Button size="sm" variant="outline" onClick={refreshLocation} isLoading={locLoading} className="h-8 text-xs bg-white dark:bg-slate-800 gap-1">
                                     <RefreshCw size={12} className={locLoading ? "animate-spin" : ""} /> Refresh
                                 </Button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Quick History */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <History size={18} className="text-indigo-500"/> Recent Activity
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {attendanceHistory.slice(0, 3).map(record => (
                                <div key={record.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50">
                                     <div className={`p-2.5 rounded-lg ${record.status === 'present' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                                         {record.status === 'present' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                     </div>
                                     <div className="flex-1">
                                         <h4 className="font-bold text-slate-800 dark:text-white">{record.subject}</h4>
                                         <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                             <Clock size={12} />
                                             <span>{new Date(record.timestamp).toLocaleString()}</span>
                                         </div>
                                     </div>
                                     <div className={`px-3 py-1 rounded-full text-xs font-bold ${record.status === 'present' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                         {record.status === 'present' ? 'Present' : 'Absent'}
                                     </div>
                                </div>
                            ))}
                            {attendanceHistory.length === 0 && (
                                <div className="text-center py-8 text-slate-400">No recent activity</div>
                            )}
                        </div>
                    </div>
                </div>
             )}
             
             {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Attendance History</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Overall: <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                        {attendanceHistory.length > 0 
                                            ? Math.round((attendanceHistory.filter(r => r.status === 'present').length / attendanceHistory.length) * 100)
                                            : 0}%
                                    </span>
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => {}}>Export</Button>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {attendanceHistory.map(record => (
                            <div key={record.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${record.status === 'present' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                                        {record.status === 'present' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">{record.subject}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {new Date(record.timestamp).toLocaleDateString()} &bull; {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {record.verifiedByFace && (
                                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                                            <ScanFace size={10} /> Biometric Verified
                                        </div>
                                    )}
                                    {record.verifiedByLocation && (
                                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">
                                            <MapPin size={10} /> GPS Verified
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {attendanceHistory.length === 0 && (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                No attendance records found.
                            </div>
                        )}
                    </div>
                </div>
             )}

             {activeTab === 'timetable' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Calendar className="text-indigo-500" size={20} /> Your Schedule
                    </h3>
                    <div className="space-y-6">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                            const dayClasses = schedule.filter(s => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                            if (dayClasses.length === 0) return null;
                            
                            return (
                                <div key={day} className="border-b border-slate-100 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                                    <h4 className="font-bold text-slate-500 dark:text-slate-400 text-sm uppercase mb-3">{day}</h4>
                                    <div className="grid gap-3">
                                        {dayClasses.map(entry => (
                                            <div key={entry.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors">
                                                <div className="text-center px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-700 dark:text-indigo-300">
                                                    <div className="text-xs font-bold">{entry.startTime}</div>
                                                    <div className="text-[10px] opacity-70">TO</div>
                                                    <div className="text-xs font-bold">{entry.endTime}</div>
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-slate-800 dark:text-white">{entry.subject}</h5>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Clock size={12} /> 60 Minutes
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {schedule.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                No classes scheduled for your department.
                            </div>
                        )}
                    </div>
                </div>
             )}

             {activeTab === 'profile' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="bg-indigo-900/5 h-32 relative">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                        </div>
                        <div className="px-6 pb-6 relative">
                            <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-12 mb-6 gap-4">
                                <div className="w-24 h-24 bg-indigo-600 rounded-2xl border-4 border-white dark:border-slate-800 shadow-lg flex items-center justify-center text-3xl font-bold text-white">
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{user.name}</h2>
                                    <p className="text-slate-500 dark:text-slate-400">{user.email}</p>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase border border-indigo-100 dark:border-indigo-800">
                                    Student
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Roll Number</label>
                                        <div className="font-mono text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded border border-slate-100 dark:border-slate-700 mt-1">
                                            {user.rollNo || 'Not Assigned'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department</label>
                                        <div className="text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded border border-slate-100 dark:border-slate-700 mt-1 flex items-center gap-2">
                                            <Briefcase size={16} className="text-slate-400" />
                                            {user.department || 'General'}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Shield size={18} className="text-green-500" /> Security Status
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${user.faceDataUrl ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    <ScanFace size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-slate-900 dark:text-white">Face ID</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.faceDataUrl ? 'Registered & Active' : 'Not Registered'}</p>
                                                </div>
                                            </div>
                                            {user.faceDataUrl ? <CheckCircle size={20} className="text-green-500" /> : <AlertTriangle size={20} className="text-red-500" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             )}
          </div>
       )}
    </div>
  );
};

export default StudentDashboard;

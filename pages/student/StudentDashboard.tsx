
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { calculateDistance, getCurrentLocation } from '../../services/geoService';
import { AttendanceRecord, TimetableEntry } from '../../types';
import { Scan, MapPin, CheckCircle, XCircle, Camera, RefreshCw, User as UserIcon, Mail, Briefcase, History, Calendar, Shield, ChevronRight, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../../components/Button';

const SUBJECTS_BY_DEPT: Record<string, string[]> = {
  "Computer Science and Engineering": ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"],
  "CSE-DS": ["ATCD", "PA", "WSMA", "NLP", "WSMA-LAB", "PA-LAB", "I&EE"],
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
  
  // State for camera constraints - using facingMode: environment for QR, user for Face
  const [videoConstraints, setVideoConstraints] = useState<MediaTrackConstraints>({ 
    facingMode: "environment" 
  });
  
  // Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [zoomCap, setZoomCap] = useState<{min: number, max: number, step: number} | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const webcamRef = useRef<Webcam>(null);

  // Load history and schedule on mount
  useEffect(() => {
    const initData = async () => {
      if (user) {
        try {
            // 1. Get actual present records
            const presentRecords = await storageService.getAttendanceForStudent(user.uid);
            
            // 2. Get all sessions to calculate absences
            const allSessions = await storageService.getAllSessions();
            const relevantSubjects = user.department ? (SUBJECTS_BY_DEPT[user.department] || []) : [];
            
            // Filter sessions for Absent logic
            const now = Date.now();
            const attendanceSessionIds = new Set(presentRecords.map(r => r.sessionId));
            
            const absentRecords: AttendanceRecord[] = allSessions
            .filter(session => {
                // Subject check
                if (relevantSubjects.length > 0 && !relevantSubjects.includes(session.subject)) return false;
                
                // Time check: Is it a past class?
                // If explicit endTime exists, check it. Else assume 90 mins.
                const isFinished = !session.isActive || (session.endTime && session.endTime < now) || (session.startTime < now - (90 * 60 * 1000));
                
                if (!isFinished) return false;
                
                // Check if already present
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

            // Merge and sort by timestamp descending
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

  // --- Automatic Camera Switch Logic ---
  useEffect(() => {
    if (scanStep === 'qr') {
      setVideoConstraints({ facingMode: "environment" }); // Back Camera
    } else if (scanStep === 'face') {
      setVideoConstraints({ facingMode: "user" }); // Front Camera
    }
  }, [scanStep]);

  const startScan = () => {
    setScanning(true);
    setScanStep('qr');
    setStatusMessage('Requesting camera access...');
    setScannedSessionId(null);
    // Reset zoom on new scan
    setZoom(1);
    setZoomCap(null);
  };

  const toggleCamera = () => {
    setVideoConstraints(prev => ({
      ...prev,
      facingMode: prev.facingMode === 'environment' ? 'user' : 'environment'
    }));
    // Reset zoom when switching cameras
    setZoom(1);
    setZoomCap(null);
  };

  // Handle Camera Errors (e.g. no back camera on laptop)
  const handleCameraError = useCallback((error: string | DOMException) => {
    console.error("Camera Error:", error);
    // If we are currently trying to use the environment camera and it fails, 
    // it might be because the device (e.g., laptop) doesn't have one.
    // Try falling back to the default/user camera.
    if (videoConstraints.facingMode === 'environment') {
      console.log("Switching to user camera fallback...");
      setVideoConstraints({ facingMode: "user" });
    } else {
      setScanStep('error');
      setStatusMessage('Camera access denied. Please check permissions or device capabilities.');
    }
  }, [videoConstraints]);

  const handleCameraLoad = useCallback((stream: MediaStream) => {
      mediaStreamRef.current = stream;
      
      // Detect Zoom Capabilities
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any; // Type assertion for non-standard properties

      if (capabilities.zoom) {
        setZoomCap({
            min: capabilities.zoom.min,
            max: capabilities.zoom.max,
            step: capabilities.zoom.step
        });
        // Initialize zoom to min
        setZoom(capabilities.zoom.min);
      } else {
        setZoomCap(null);
      }

      if (scanStep === 'qr') setStatusMessage('Align QR code within frame');
      if (scanStep === 'face') setStatusMessage('Face Verification');
  }, [scanStep]);

  const handleZoom = async (newZoom: number) => {
    if (!mediaStreamRef.current || !zoomCap) return;
    
    // Clamp value
    const z = Math.min(Math.max(newZoom, zoomCap.min), zoomCap.max);
    setZoom(z);

    const track = mediaStreamRef.current.getVideoTracks()[0];
    try {
        await track.applyConstraints({
            advanced: [{ zoom: z }]
        } as any);
    } catch (e) {
        console.error("Zoom failed", e);
    }
  };

  // --- Automatic QR Scanning Loop ---
  useEffect(() => {
    // Only run if scanning for QR and step is QR
    if (scanStep !== 'qr' || !scanning) return;

    const scanInterval = setInterval(() => {
      if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
        const video = webcamRef.current.video;
        
        // Safety check
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Create temporary canvas to draw video frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // OPTIMIZATION: Crop detection to the center 60% of the frame
          const size = Math.min(canvas.width, canvas.height) * 0.6;
          const x = (canvas.width - size) / 2;
          const y = (canvas.height - size) / 2;
          
          const imageData = ctx.getImageData(x, y, size, size);
          
          // Attempt to decode QR code
          const code = jsQR(imageData.data, size, size);
          
          if (code) {
            // Valid QR found
            handleQrDetected(code.data);
          }
        }
      }
    }, 300); // Check every 300ms

    return () => clearInterval(scanInterval);
  }, [scanStep, scanning]);

  const handleQrDetected = async (qrData: string) => {
    if (qrData.startsWith("SECURE:")) {
       const validation = await storageService.validateQR(qrData);
       
       if (validation.valid && validation.sessionId) {
         setScannedSessionId(validation.sessionId);
         setStatusMessage('Verified. Switching to Face ID...');
         
         // This state change triggers the camera switch via the useEffect above
         setScanStep('face'); 
       } else {
         console.log("Invalid QR:", validation.error);
       }
    }
  };

  // --- Automatic Face Verification Trigger ---
  useEffect(() => {
    if (scanStep !== 'face') return;

    // Give the user 3 seconds to position their face after camera switches
    const timer = setTimeout(() => {
      verifyIdentityAndMark();
    }, 3000);

    return () => clearTimeout(timer);
  }, [scanStep]);


  const verifyIdentityAndMark = async () => {
    if (!user || !scannedSessionId) return;
    
    setStatusMessage('Verifying Location & Face...');
    
    try {
      // 1. Capture Face
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error("Could not capture face. Ensure camera is enabled.");

      // 2. Check Location
      const studentLoc = await getCurrentLocation();
      const session = await storageService.getSessionById(scannedSessionId);
      
      if (!session) throw new Error("Session ended or invalid.");

      const distance = calculateDistance(studentLoc, session.location);
      
      // Allow slightly larger radius for GPS drift (30-50m)
      const MAX_DISTANCE_METERS = 50; 
      
      if (distance > MAX_DISTANCE_METERS) { 
         console.log(`Distance Rejected: ${distance}m`);
         throw new Error(`Location mismatch! You are ${Math.round(distance)}m away from class. (Max allowed: ${MAX_DISTANCE_METERS}m)`);
      }

      // 3. Mark Attendance
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

      const success = await storageService.markAttendance(record);
      
      if (success) {
        setScanStep('success');
        // Add to history immediately for UI feedback
        setAttendanceHistory(prev => [record, ...prev].sort((a, b) => b.timestamp - a.timestamp));
      } else {
        throw new Error('Attendance already marked for this session.');
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
    setVideoConstraints({ facingMode: "environment" });
  };

  const getAttendanceStats = () => {
    const totalClasses = attendanceHistory.length;
    const attended = attendanceHistory.filter(r => r.status === 'present').length;
    const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 100;
    return { totalClasses, attended, percentage };
  };

  const getSubjectStats = () => {
    const subjectMap: Record<string, { total: number; attended: number }> = {};
    
    attendanceHistory.forEach(record => {
      if (!subjectMap[record.subject]) {
        subjectMap[record.subject] = { total: 0, attended: 0 };
      }
      subjectMap[record.subject].total += 1;
      if (record.status === 'present') {
        subjectMap[record.subject].attended += 1;
      }
    });

    return Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      total: data.total,
      attended: data.attended,
      percentage: data.total > 0 ? Math.round((data.attended / data.total) * 100) : 0
    })).sort((a, b) => a.subject.localeCompare(b.subject));
  };

  const stats = getAttendanceStats();
  const subjectStats = getSubjectStats();

  return (
    <div className="space-y-6 relative max-w-5xl mx-auto">
      <div className="mt-0">
        {/* MARK ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-indigo-100 dark:border-slate-700 transition-colors duration-200 min-h-[500px] flex flex-col">
            <div className="flex-1 flex flex-col justify-center relative bg-slate-50 dark:bg-slate-900">
              
              {/* IDLE STATE */}
              {scanStep === 'idle' && (
                <div className="p-10 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                  <div className="relative mb-8 group">
                    <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500 animate-pulse"></div>
                    <div className="relative w-28 h-28 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border-4 border-indigo-50 dark:border-indigo-900/50 shadow-lg group-hover:scale-105 transition-transform duration-300">
                      <Scan size={50} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                  
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">Smart Attendance</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg">
                    Scan the classroom QR code to verify your location and identity instantly.
                  </p>
                  
                  <button 
                    onClick={startScan}
                    className="group relative flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-indigo-500/30 transition-all active:scale-95"
                  >
                    <Camera className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <span>Launch Scanner</span>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 animate-ping"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></div>
                  </button>
                  
                  <div className="mt-8 flex items-center gap-4 text-sm text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1"><Shield size={14}/> Secure</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    <span className="flex items-center gap-1"><MapPin size={14}/> GPS Required</span>
                  </div>
                </div>
              )}

              {/* SCANNING STATE (QR & FACE) */}
              {(scanStep === 'qr' || scanStep === 'face') && (
                <div className="relative w-full h-full flex flex-col bg-black">
                  <div className="relative flex-1 overflow-hidden min-h-[400px]">
                     {/* Webcam Feed */}
                     <Webcam
                      key={JSON.stringify(videoConstraints)}
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="absolute inset-0 w-full h-full object-cover"
                      videoConstraints={videoConstraints}
                      forceScreenshotSourceSize={true}
                      playsInline={true}
                      onUserMediaError={handleCameraError}
                      onUserMedia={handleCameraLoad}
                    />

                    {/* Camera Switch Button */}
                    <button 
                        onClick={toggleCamera}
                        className="absolute top-6 right-6 z-30 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/20"
                        title="Switch Camera"
                    >
                        <SwitchCamera size={24} />
                    </button>

                    {/* ZOOM CONTROLS - Only if supported */}
                    {scanStep === 'qr' && zoomCap && (
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 bg-black/40 p-2 rounded-full backdrop-blur-md border border-white/10 animate-in fade-in duration-300">
                         <button 
                            onClick={() => handleZoom(zoom + zoomCap.step * 2)} 
                            className="text-white/80 hover:text-white p-2 active:scale-90 transition-transform"
                            disabled={zoom >= zoomCap.max}
                         >
                            <ZoomIn size={24}/>
                         </button>
                         
                         <div className="h-24 w-1.5 bg-white/20 rounded-full relative overflow-hidden">
                            <div 
                                className="absolute bottom-0 w-full bg-indigo-500 rounded-full transition-all duration-300 ease-out" 
                                style={{ height: `${((zoom - zoomCap.min) / (zoomCap.max - zoomCap.min)) * 100}%` }}
                            ></div>
                         </div>
                         
                         <button 
                            onClick={() => handleZoom(zoom - zoomCap.step * 2)} 
                            className="text-white/80 hover:text-white p-2 active:scale-90 transition-transform"
                            disabled={zoom <= zoomCap.min}
                         >
                            <ZoomOut size={24}/>
                         </button>
                         <div className="text-[10px] font-bold text-white bg-black/50 px-1 rounded">
                            {zoom.toFixed(1)}x
                         </div>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-6 left-0 right-0 flex justify-center z-20">
                       <div className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white text-sm font-medium flex items-center gap-2 border border-white/10 shadow-lg">
                          {scanStep === 'face' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                              {statusMessage || 'Face Verification'}
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                              {statusMessage || 'Requesting Camera...'}
                            </>
                          )}
                       </div>
                    </div>

                    {/* QR Overlay */}
                    {scanStep === 'qr' && (
                      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                         {/* Mask Effect using box-shadow for clear center */}
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-72 h-72 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                               <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-indigo-500 rounded-tl-3xl"></div>
                               <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-indigo-500 rounded-tr-3xl"></div>
                               <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-indigo-500 rounded-bl-3xl"></div>
                               <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-indigo-500 rounded-br-3xl"></div>
                               <div className="absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_20px_rgba(99,102,241,1)] animate-scan opacity-80"></div>
                            </div>
                         </div>
                         
                         <div className="absolute bottom-10 left-0 right-0 text-center">
                            <p className="text-white/90 text-sm font-medium drop-shadow-md">Align the Faculty QR code within the frame</p>
                         </div>
                      </div>
                    )}

                    {/* Face Overlay */}
                    {scanStep === 'face' && (
                      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="relative">
                              {/* Circle Frame with Mask Shadow */}
                              <div className="w-64 h-64 rounded-full border-4 border-blue-500/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] overflow-hidden relative">
                                 {/* Radar Scan Effect */}
                                 <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-transparent animate-scan"></div>
                              </div>
                              {/* Pulsing Ring */}
                              <div className="absolute inset-0 -m-4 border border-blue-500/50 rounded-full animate-ping opacity-30"></div>
                           </div>
                        </div>
                        <div className="absolute bottom-10 left-0 right-0 text-center px-6">
                            <h3 className="text-white text-lg font-bold mb-1 drop-shadow-md">Verify Identity</h3>
                            <p className="text-white/80 text-sm drop-shadow-md">Position your face within the circle. Hold still.</p>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Controls */}
                  <div className="bg-white dark:bg-slate-900 p-6 border-t border-slate-200 dark:border-slate-800 z-20">
                    <Button variant="secondary" onClick={reset} className="w-full py-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">
                      Cancel Scanning
                    </Button>
                  </div>
                </div>
              )}

              {/* SUCCESS STATE */}
              {scanStep === 'success' && (
                <div className="p-12 flex flex-col items-center justify-center text-center h-full animate-in fade-in zoom-in duration-500">
                  <div className="w-28 h-28 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8 text-green-600 dark:text-green-400 shadow-lg shadow-green-200/50 dark:shadow-none relative">
                    <CheckCircle size={60} />
                    <div className="absolute inset-0 border-4 border-green-500/20 rounded-full animate-ping"></div>
                  </div>
                  <h2 className="text-4xl font-bold text-slate-800 dark:text-white mb-3">You're In!</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg max-w-md mx-auto">
                    Attendance has been successfully verified and recorded for this session.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                     <Button 
                       onClick={() => { reset(); window.history.pushState({}, '', '?view=history'); }} 
                       className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200/50 dark:shadow-none"
                     >
                       <History className="mr-2 w-5 h-5" /> View History
                     </Button>
                     <Button variant="secondary" onClick={reset} className="flex-1 py-3">
                       Done
                     </Button>
                  </div>
                </div>
              )}

              {/* ERROR STATE */}
              {scanStep === 'error' && (
                <div className="p-12 flex flex-col items-center justify-center text-center h-full animate-in shake duration-300">
                   <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400">
                    <XCircle size={50} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Verification Failed</h2>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-xl mb-8 max-w-sm w-full">
                    <p className="text-red-600 dark:text-red-300 font-medium text-sm">
                      {statusMessage}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="secondary" onClick={reset} className="px-8">Close</Button>
                    <Button onClick={startScan} className="px-8 bg-slate-800 text-white hover:bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-700">
                      <RefreshCw className="mr-2 w-4 h-4"/> Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY & STATUS TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Status Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Overall Attendance Card */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-8">
                <div className="relative w-32 h-32 flex-shrink-0">
                   <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-slate-100 dark:text-slate-700"
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
                        strokeLinecap="round"
                      />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-3xl font-bold text-slate-800 dark:text-white">{stats.percentage}%</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mt-1">Present</span>
                   </div>
                </div>
                <div>
                   <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Overall Attendance</h3>
                   <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                     You have attended <strong className="text-slate-800 dark:text-white">{stats.attended}</strong> out of <strong className="text-slate-800 dark:text-white">{stats.totalClasses}</strong> total sessions.
                   </p>
                   {stats.percentage < 75 ? (
                     <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-800">
                       <XCircle size={14} /> Low Attendance Warning
                     </div>
                   ) : (
                     <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800">
                       <CheckCircle size={14} /> Good Standing
                     </div>
                   )}
                </div>
              </div>

              {/* Subject Breakdown Card */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Subject Breakdown</h3>
                <div className="space-y-5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {subjectStats.length > 0 ? (
                    subjectStats.map(stat => (
                      <div key={stat.subject} className="group">
                        <div className="flex justify-between text-sm mb-2">
                           <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[70%] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{stat.subject}</span>
                           <span className={`font-bold ${
                               stat.percentage >= 75 ? 'text-green-600 dark:text-green-400' : 
                               stat.percentage >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                           }`}>
                             {stat.percentage}%
                           </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                             stat.percentage >= 75 ? 'bg-green-500' : 
                             stat.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} style={{ width: `${stat.percentage}%` }}></div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 text-right">
                          {stat.attended} / {stat.total} classes
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-400 py-8 flex flex-col items-center">
                      <Briefcase size={32} className="mb-2 opacity-50" />
                      No attendance data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* History List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <History size={22} className="text-indigo-500" /> Recent Activity
              </h3>
              <div className="space-y-3">
                {attendanceHistory.length === 0 ? (
                   <div className="text-center py-16 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-600">
                     <History size={48} className="mx-auto text-slate-300 dark:text-slate-500 mb-4" />
                     <h4 className="text-lg font-medium text-slate-500 dark:text-slate-400">No History Yet</h4>
                     <p className="text-slate-400 dark:text-slate-500 text-sm">Your attendance records will appear here.</p>
                   </div>
                ) : (
                   attendanceHistory.map((record) => (
                    <div key={record.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border transition-all hover:shadow-md ${
                        record.status === 'present' 
                        ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/50'
                        : 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-200'
                    }`}>
                      <div className="flex items-center gap-5 mb-3 sm:mb-0">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ${
                            record.status === 'present'
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                          {record.subject.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-lg">{record.subject}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                            <Calendar size={14} />
                            {new Date(record.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} 
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
                            {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 pl-[4.5rem] sm:pl-0">
                        {record.status === 'present' ? (
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase shadow-sm border border-green-200 dark:border-green-900/50 flex items-center gap-1">
                              <CheckCircle size={12} /> Present
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-bold uppercase shadow-sm border border-red-200 dark:border-red-900/50 flex items-center gap-1">
                              <XCircle size={12} /> Absent
                            </span>
                        )}
                        
                        {record.status === 'present' && record.verifiedByLocation && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                             <MapPin size={12} /> GPS Verified
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[400px]">
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
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar size={32} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300">No Classes Scheduled</h4>
                    <p className="text-slate-400 dark:text-slate-500 mt-2 max-w-xs mx-auto text-sm">
                      Your faculty hasn't posted any classes for your department subjects yet.
                    </p>
                  </div>
               ) : (
                 <div className="space-y-6">
                    <div className="grid gap-4">
                      {schedule.map(entry => (
                        <div key={entry.id} className="group flex flex-col md:flex-row md:items-center justify-between p-5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-l-xl"></div>
                          <div className="mb-3 md:mb-0 pl-3">
                            <h4 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{entry.subject}</h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                               <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-medium">
                                 <Calendar size={14} className="text-indigo-500" /> {entry.day}
                               </span>
                               <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-medium">
                                 <History size={14} className="text-indigo-500" /> {entry.startTime} - {entry.endTime}
                               </span>
                            </div>
                          </div>
                          {/* Link to Mark Attendance view */}
                           <a 
                            href="?view=attendance"
                            className="inline-flex items-center justify-center px-5 py-2.5 text-sm bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all active:scale-95"
                          >
                            Go to Class <ChevronRight size={16} className="ml-1" />
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
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
             <div className="bg-indigo-600 dark:bg-slate-950 p-10 text-center transition-colors duration-200 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none mix-blend-overlay">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                     </pattern>
                     <rect width="100" height="100" fill="url(#grid)" />
                  </svg>
               </div>
               <div className="relative z-10">
                 <div className="w-32 h-32 bg-white dark:bg-slate-800 rounded-full mx-auto mb-4 p-1.5 overflow-hidden shadow-2xl border-4 border-white/20">
                    {user?.faceDataUrl ? (
                       <img src={user.faceDataUrl} alt="Face ID" className="w-full h-full object-cover rounded-full" />
                    ) : (
                       <div className="w-full h-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
                         <UserIcon size={48} />
                       </div>
                    )}
                 </div>
                 <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{user?.name}</h2>
                 <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
                   <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                   <p className="text-white text-sm font-mono tracking-wide">ID: {user?.uid.substring(0, 8).toUpperCase()}</p>
                 </div>
               </div>
             </div>
             
             <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Personal Information</h4>
                      
                      <div className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                         <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm mr-4 group-hover:text-indigo-500 transition-colors">
                            <UserIcon size={22} />
                         </div>
                         <div>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Full Name</p>
                           <p className="font-bold text-slate-800 dark:text-white text-lg">{user?.name}</p>
                         </div>
                      </div>

                      <div className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                         <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm mr-4 group-hover:text-indigo-500 transition-colors">
                            <Mail size={22} />
                         </div>
                         <div>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Email Address</p>
                           <p className="font-bold text-slate-800 dark:text-white text-lg">{user?.email}</p>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Academic Details</h4>

                      <div className="group flex items-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                         <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm mr-4 group-hover:text-indigo-500 transition-colors">
                            <Briefcase size={22} />
                         </div>
                         <div>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Department</p>
                           <p className="font-bold text-slate-800 dark:text-white text-lg">{user?.department || 'Not Assigned'}</p>
                         </div>
                      </div>
                      
                      <div className="p-5 border border-indigo-100 dark:border-slate-700 rounded-2xl bg-indigo-50/50 dark:bg-slate-800">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-indigo-900 dark:text-white flex items-center gap-2">
                               <Scan size={16} className="text-indigo-500" /> Face ID Security
                            </span>
                            <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase tracking-wide rounded-full border border-green-200 dark:border-green-900/50 shadow-sm">Active</span>
                         </div>
                         <p className="text-xs text-indigo-700/70 dark:text-slate-400 leading-relaxed">
                           Your biometric data is encrypted and stored securely. It is used exclusively for real-time attendance verification during scheduled class sessions.
                         </p>
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

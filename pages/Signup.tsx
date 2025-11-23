import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { DEPARTMENTS, SUBJECTS_BY_DEPT } from '../utils/constants';
import { Camera, CheckCircle, Lock, Building2, BookOpen, Eye, EyeOff, Sun, Moon, Hash, RefreshCw, ScanFace, X, User as UserIcon, ShieldCheck, Sparkles, Maximize } from 'lucide-react';
import Button from '../components/Button';

const Signup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const { signup } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const capture = useCallback(() => {
    setIsFlashing(true);
    setTimeout(() => {
        if (webcamRef.current) {
          const imageSrc = webcamRef.current.getScreenshot();
          setFaceImage(imageSrc);
        }
        setIsFlashing(false);
    }, 150);
  }, [webcamRef]);

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepartment(e.target.value);
    setSubject('');
  };

  const handleSignup = async () => {
    if (role === UserRole.STUDENT && !faceImage) {
        setError("Please register your face ID before creating an account.");
        return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await signup({
        uid: Date.now().toString(),
        name,
        email,
        password,
        role,
        department: (role === UserRole.STUDENT || role === UserRole.FACULTY) ? department : undefined,
        subject: (role === UserRole.FACULTY) ? subject : undefined,
        rollNo: (role === UserRole.STUDENT) ? rollNo : undefined,
        faceDataUrl: faceImage || undefined
      });

      if (role === UserRole.FACULTY) navigate('/faculty');
      else navigate('/student');
    } catch (err: any) {
      console.error('Signup error:', err);
      const errorMessage = err?.message || 'Failed to create account. Please try again.';
      
      if (errorMessage.includes('project')) {
        setError('Configuration Error: Firebase Project ID invalid. Please update firebase.ts');
      } else if (errorMessage.includes('permission')) {
        setError('Database Error: Insufficient permissions. Check Firestore rules.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const requiresFaceId = role === UserRole.STUDENT;
  const requiresDepartment = role === UserRole.STUDENT || role === UserRole.FACULTY;
  const requiresSubject = role === UserRole.FACULTY;
  const requiresRollNo = role === UserRole.STUDENT;
  
  const isDetailsValid = name && email && password && 
    (!requiresDepartment || department) &&
    (!requiresSubject || subject) &&
    (!requiresRollNo || rollNo);

  const isFormValid = isDetailsValid && (!requiresFaceId || faceImage);

  const openFaceModal = () => {
    setError('');
    setShowFaceModal(true);
  };

  const closeFaceModal = () => {
      setShowFaceModal(false);
  };

  const confirmFaceCapture = () => {
      setShowFaceModal(false);
  };

  const retakeFace = () => {
      setFaceImage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors duration-200">
      <button 
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
        <div className="bg-indigo-900 dark:bg-slate-950 p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
             <h2 className="text-xl font-bold">Create Account</h2>
             <p className="text-indigo-200 text-sm">Join the smart attendance system</p>
          </div>
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-800 rounded-full opacity-50"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-16 h-16 bg-indigo-700 rounded-full opacity-30"></div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}
          
          <div className="space-y-6">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">I am a...</label>
                <div className="grid grid-cols-2 gap-4">
                  {[UserRole.STUDENT, UserRole.FACULTY].map((r) => (
                     <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`p-3 sm:p-4 border rounded-xl text-center transition-all relative overflow-hidden ${role === r ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                      >
                        <span className="block font-semibold text-slate-800 dark:text-slate-200 capitalize relative z-10">{r}</span>
                        {role === r && <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/20 opacity-20"></div>}
                      </button>
                  ))}
                </div>
              </div>

              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>
              
              {/* Roll Number */}
              {requiresRollNo && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Roll Number</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Hash className="h-4 w-4 text-slate-400" />
                     </div>
                     <input
                        type="text"
                        value={rollNo}
                        onChange={(e) => setRollNo(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors uppercase"
                        placeholder="e.g. 21XX1A05XX"
                        required
                     />
                  </div>
                </div>
              )}

              {/* Department & Subject */}
              {requiresDepartment && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Building2 className="h-4 w-4 text-slate-400" />
                     </div>
                     <select
                        value={department}
                        onChange={handleDepartmentChange}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                        required
                     >
                        <option value="">Select Department</option>
                        {DEPARTMENTS.map((dept) => (
                           <option key={dept} value={dept}>{dept}</option>
                        ))}
                     </select>
                  </div>
                </div>
              )}

              {requiresSubject && department && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject Specialization</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <BookOpen className="h-4 w-4 text-slate-400" />
                     </div>
                     <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                        required
                     >
                        <option value="">Select Subject</option>
                        {SUBJECTS_BY_DEPT[department]?.map((subj) => (
                           <option key={subj} value={subj}>{subj}</option>
                        ))}
                     </select>
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Lock className="h-4 w-4 text-slate-400" />
                   </div>
                   <input
                     type={showPassword ? 'text' : 'password'}
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="block w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                     placeholder="Create a secure password"
                     required
                   />
                   <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                   >
                     {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                   </button>
                </div>
              </div>

              {/* Compact Face Registration UI - Row Style */}
              {requiresFaceId && (
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Face Verification</label>
                      <div 
                        onClick={openFaceModal}
                        className={`cursor-pointer relative overflow-hidden group rounded-xl border-2 transition-all duration-200 flex items-center p-3 gap-4 ${
                            faceImage 
                            ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' 
                            : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                          <div className={`w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center shadow-sm ${faceImage ? 'bg-white' : 'bg-slate-100 dark:bg-slate-700'}`}>
                             {faceImage ? (
                                 <img src={faceImage} className="w-full h-full rounded-full object-cover transform scale-x-[-1]" alt="Face" />
                             ) : (
                                 <ScanFace className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={24} />
                             )}
                          </div>
                          
                          <div className="flex-1">
                             <h4 className={`font-semibold text-sm ${faceImage ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {faceImage ? 'Face ID Registered' : 'Register Face ID'}
                             </h4>
                             <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {faceImage ? 'Click to update photo' : ''}
                             </p>
                          </div>
                          
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                             faceImage 
                             ? 'bg-white text-green-700 shadow-sm border border-green-200' 
                             : 'bg-indigo-600 text-white shadow-sm group-hover:bg-indigo-700'
                          }`}>
                             {faceImage ? 'Retake' : 'Start Scan'}
                          </div>
                      </div>
                  </div>
              )}

              <div className="pt-4">
                <Button 
                  onClick={handleSignup} 
                  disabled={!isFormValid}
                  isLoading={isLoading}
                  className="w-full py-3 text-lg shadow-lg shadow-indigo-500/20"
                >
                  Create Account
                </Button>
              </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account? <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-500 dark:hover:text-indigo-300">Login</Link>
          </div>
        </div>
      </div>

      {/* Modern Full-Screen Scanner UI */}
      {showFaceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4 animate-in fade-in duration-300">
             <div className="relative w-full max-w-md bg-black rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col h-[600px] max-h-[90vh]">
                
                {/* Floating Header */}
                <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-12">
                   <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                        <h3 className="font-medium text-sm text-white flex items-center gap-2">
                             <ScanFace className="text-indigo-400" size={16} /> 
                             {faceImage ? "Verification Complete" : "Scan Face"}
                        </h3>
                   </div>
                   <button onClick={closeFaceModal} className="p-2.5 bg-black/40 backdrop-blur-md hover:bg-white/10 rounded-full text-white/90 transition-colors border border-white/10 shadow-lg">
                     <X size={20} />
                   </button>
                </div>

                {/* Camera Viewport */}
                <div className="relative flex-1 bg-slate-900 overflow-hidden">
                     {faceImage ? (
                         <img src={faceImage} className="w-full h-full object-cover transform scale-x-[-1]" alt="Captured" />
                     ) : (
                         <Webcam
                             audio={false}
                             ref={webcamRef}
                             screenshotFormat="image/jpeg"
                             className="w-full h-full object-cover"
                             videoConstraints={{ facingMode: "user", aspectRatio: 0.75 }}
                             mirrored={true}
                         />
                     )}
                     
                     {/* Flash Effect */}
                     {isFlashing && <div className="absolute inset-0 bg-white animate-out fade-out duration-300 z-50 pointer-events-none"></div>}

                     {/* HUD Overlay */}
                     <div className="absolute inset-0 pointer-events-none">
                        {/* Grid Background */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
                        
                        {!faceImage ? (
                            <>
                                {/* Viewfinder Brackets */}
                                <div className="absolute top-16 left-8 w-12 h-12 border-t-[3px] border-l-[3px] border-indigo-500/80 rounded-tl-2xl"></div>
                                <div className="absolute top-16 right-8 w-12 h-12 border-t-[3px] border-r-[3px] border-indigo-500/80 rounded-tr-2xl"></div>
                                <div className="absolute bottom-32 left-8 w-12 h-12 border-b-[3px] border-l-[3px] border-indigo-500/80 rounded-bl-2xl"></div>
                                <div className="absolute bottom-32 right-8 w-12 h-12 border-b-[3px] border-r-[3px] border-indigo-500/80 rounded-br-2xl"></div>
                                
                                {/* Laser Scan Line */}
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.8)] animate-scan"></div>
                                
                                {/* Central Focus Reticle */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border border-indigo-400/20 rounded-[2.5rem]">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-2 bg-indigo-400/50"></div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-2 bg-indigo-400/50"></div>
                                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-1 bg-indigo-400/50"></div>
                                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2 h-1 bg-indigo-400/50"></div>
                                </div>

                                <div className="absolute bottom-36 left-0 right-0 text-center">
                                    <span className="inline-block px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-xs font-medium text-indigo-200 border border-indigo-500/20 tracking-wide">
                                        ALIGN FACE IN FRAME
                                    </span>
                                </div>
                            </>
                        ) : (
                            /* Success Overlay */
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                                <div className="flex flex-col items-center animate-in zoom-in duration-300 p-8 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl">
                                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)] mb-4">
                                        <CheckCircle className="text-white w-10 h-10" />
                                    </div>
                                    <h3 className="text-white font-bold text-xl tracking-tight">Scan Successful</h3>
                                    <p className="text-indigo-100/80 text-sm mt-1 font-medium">ID Generated</p>
                                </div>
                            </div>
                        )}
                     </div>
                </div>

                {/* Footer Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-20 pb-8 px-8 z-30">
                    {faceImage ? (
                       <div className="grid grid-cols-2 gap-4">
                          <Button variant="secondary" onClick={retakeFace} className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-md h-12 rounded-xl">
                              <RefreshCw size={18} /> Retake
                          </Button>
                          <Button onClick={confirmFaceCapture} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 h-12 rounded-xl border-none">
                              Use Photo
                          </Button>
                       </div>
                    ) : (
                       <button 
                          onClick={capture} 
                          className="w-full h-14 bg-white text-black rounded-2xl font-bold text-lg shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:bg-indigo-50 hover:shadow-[0_0_35px_rgba(255,255,255,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                       >
                          <div className="p-1.5 bg-black rounded-full text-white group-hover:bg-indigo-600 transition-colors">
                              <Camera size={18} />
                          </div>
                          Capture Photo
                       </button>
                    )}
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default Signup;

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { DEPARTMENTS, SUBJECTS_BY_DEPT } from '../utils/constants';
import { Camera, CheckCircle, Lock, Building2, BookOpen, Eye, EyeOff, Sun, Moon, Hash, RefreshCw, ScanFace, X } from 'lucide-react';
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
  
  const webcamRef = useRef<Webcam>(null);
  const { signup } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setFaceImage(imageSrc);
    }
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

      if (role === UserRole.ADMIN) navigate('/admin');
      else if (role === UserRole.FACULTY) navigate('/faculty');
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
      // If we haven't confirmed (saved) the image, we might want to clear it? 
      // Current logic sets faceImage immediately on capture. 
      // If user closes without "confirming", it's technically already set in state.
      // We'll assume closing means they are done or cancelled. 
      // If they captured but want to cancel, they can Retake or we can add cancel logic.
      // For simplicity, close just hides modal.
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
        <div className="bg-indigo-900 dark:bg-slate-950 p-6 text-white">
          <h2 className="text-xl font-bold">Create Account</h2>
          <p className="text-indigo-200 text-sm">Join the smart attendance system</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}
          
          <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">I am a...</label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setRole(UserRole.STUDENT)}
                    className={`p-4 border rounded-xl text-center transition-all ${role === UserRole.STUDENT ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                  >
                    <span className="block font-semibold text-slate-800 dark:text-slate-200">Student</span>
                  </button>
                  <button
                    onClick={() => setRole(UserRole.FACULTY)}
                    className={`p-4 border rounded-xl text-center transition-all ${role === UserRole.FACULTY ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                  >
                    <span className="block font-semibold text-slate-800 dark:text-slate-200">Faculty</span>
                  </button>
                  <button
                    onClick={() => setRole(UserRole.ADMIN)}
                    className={`p-4 border rounded-xl text-center transition-all ${role === UserRole.ADMIN ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                  >
                    <span className="block font-semibold text-slate-800 dark:text-slate-200">Admin</span>
                  </button>
                </div>
              </div>

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

              {requiresFaceId && (
                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex justify-between items-center mb-3">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Face Registration</label>
                          {faceImage && <span className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center"><CheckCircle size={12} className="mr-1"/> Completed</span>}
                      </div>
                      
                      {faceImage ? (
                          <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-lg overflow-hidden ring-2 ring-indigo-500">
                                  <img src={faceImage} alt="Face" className="w-full h-full object-cover transform scale-x-[-1]" />
                              </div>
                              <div className="flex-1">
                                  <p className="text-sm text-slate-600 dark:text-slate-300">Biometric ID captured successfully.</p>
                                  <button onClick={openFaceModal} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1">
                                      Retake Photo
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <Button type="button" onClick={openFaceModal} variant="outline" className="w-full border-dashed border-2 h-24 flex flex-col gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300">
                              <ScanFace className="w-6 h-6" />
                              <span>Click to Register Face ID</span>
                          </Button>
                      )}
                  </div>
              )}

              <div className="pt-2">
                <Button 
                  onClick={handleSignup} 
                  disabled={!isFormValid}
                  isLoading={isLoading}
                  className="w-full py-3 text-lg"
                >
                  Create Account
                </Button>
              </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account? <Link to="/login" className="text-slate-600 dark:text-slate-400 font-medium hover:text-indigo-600 dark:hover:text-indigo-400">Login</Link>
          </div>
        </div>
      </div>

      {/* Face Registration Modal */}
      {showFaceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                          <ScanFace className="text-indigo-500"/> Register Face ID
                      </h3>
                      <button onClick={closeFaceModal} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-4 flex-1 overflow-y-auto">
                      <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden shadow-inner mb-4 ring-1 ring-slate-200 dark:ring-slate-700">
                        {faceImage ? (
                          <img src={faceImage} alt="Captured" className="w-full h-full object-cover transform scale-x-[-1]" />
                        ) : (
                          <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover transform scale-x-[-1]"
                            videoConstraints={{ facingMode: "user" }}
                            mirrored={true}
                          />
                        )}
                        
                        {/* Biometric Overlay - Only show when camera is active and no image captured */}
                        {!faceImage && (
                          <>
                            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_30%,rgba(0,0,0,0.7)_100%)]"></div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="relative w-48 h-64 border-2 border-white/30 rounded-[50%] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)_inset]">
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1 h-3 bg-indigo-500/80"></div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1 h-3 bg-indigo-500/80"></div>
                                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-1 bg-indigo-500/80"></div>
                                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-3 h-1 bg-indigo-500/80"></div>
                                <div className="w-full h-1 bg-indigo-400/60 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-scan opacity-60"></div>
                              </div>
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                              <span className="inline-block bg-black/60 backdrop-blur-md text-white text-xs font-medium px-4 py-1.5 rounded-full border border-white/10">
                                Position face in oval
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex justify-center">
                        {faceImage ? (
                            <div className="flex gap-3 w-full">
                                <Button variant="secondary" onClick={retakeFace} className="flex-1">
                                    <RefreshCw className="w-4 h-4 mr-2" /> Retake
                                </Button>
                                <Button onClick={confirmFaceCapture} className="flex-1 bg-green-600 hover:bg-green-700 border-transparent">
                                    <CheckCircle className="w-4 h-4 mr-2" /> Confirm
                                </Button>
                            </div>
                        ) : (
                            <button 
                                onClick={capture}
                                className="w-16 h-16 rounded-full border-4 border-indigo-500 flex items-center justify-center bg-white/10 hover:bg-indigo-500 transition-all duration-300 group focus:outline-none focus:ring-4 focus:ring-indigo-500/30 shadow-lg"
                                title="Capture Photo"
                            >
                                <div className="w-12 h-12 bg-indigo-500 rounded-full group-hover:scale-90 transition-transform duration-200"></div>
                            </button>
                        )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Signup;

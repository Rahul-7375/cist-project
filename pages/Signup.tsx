
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { Camera, CheckCircle, Lock, Building2, BookOpen, Eye, EyeOff, Sun, Moon, Hash } from 'lucide-react';
import Button from '../components/Button';

const DEPARTMENTS = [
  "Computer Science and Engineering",
  "CSE-DS",
  "CSE-AIML",
  "Civil Engineering",
  "Electronics and Communications Engineering",
  "Mechanical Engineering"
];

const SUBJECTS_BY_DEPT: Record<string, string[]> = {
  "Computer Science and Engineering": ["Data Structures", "Algorithms", "Database Systems", "Operating Systems", "Computer Networks"],
  "CSE-DS": ["ATCD", "PA", "WSMA", "NLP", "WSMA-LAB", "PA-LAB", "I&EE"],
  "CSE-AIML": ["Artificial Intelligence", "Deep Learning", "Neural Networks", "Natural Language Processing", "Computer Vision"],
  "Civil Engineering": ["Structural Analysis", "Geotechnical Engineering", "Surveying", "Construction Mgmt"],
  "Electronics and Communications Engineering": ["Digital Electronics", "Signals & Systems", "Microprocessors", "VLSI Design", "Communication Systems"],
  "Mechanical Engineering": ["Thermodynamics", "Fluid Mechanics", "Strength of Materials", "Machine Design"]
};

const Signup: React.FC = () => {
  const [step, setStep] = useState(1);
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
    if (role === UserRole.STUDENT && !faceImage) return;
    
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
        <div className="bg-indigo-900 dark:bg-slate-950 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">Create Account</h2>
          {requiresFaceId && (
            <div className="text-sm bg-indigo-800 dark:bg-slate-800 px-3 py-1 rounded-full">Step {step} of 2</div>
          )}
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}
          
          {step === 1 ? (
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

              <div className="flex justify-end">
                <Button 
                  onClick={requiresFaceId ? () => setStep(2) : handleSignup} 
                  disabled={!isDetailsValid}
                  isLoading={!requiresFaceId && isLoading}
                >
                  {requiresFaceId ? 'Next: Face Registration' : 'Create Account'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Register Face ID</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">This will be used to verify your attendance.</p>
              </div>

              <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center border-2 border-slate-200 dark:border-slate-700">
                {faceImage ? (
                  <img src={faceImage} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user" }}
                    mirrored={true}
                  />
                )}
                
                {!faceImage && (
                  <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-xl m-8 pointer-events-none border-dashed"></div>
                )}
              </div>

              <div className="flex justify-center gap-4">
                {faceImage ? (
                  <Button variant="secondary" onClick={() => setFaceImage(null)}>
                    <Camera className="w-4 h-4 mr-2" /> Retake
                  </Button>
                ) : (
                  <Button onClick={capture}>
                    <Camera className="w-4 h-4 mr-2" /> Capture Face
                  </Button>
                )}
              </div>

              <div className="flex justify-between border-t dark:border-slate-700 pt-6 mt-6">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={handleSignup} disabled={!faceImage} isLoading={isLoading}>
                  <CheckCircle className="w-4 h-4 mr-2" /> Complete Registration
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account? <Link to="/login" className="text-slate-600 dark:text-slate-400 font-medium hover:text-indigo-600 dark:hover:text-indigo-400">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
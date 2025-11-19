import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowLeft, Sun, Moon } from 'lucide-react';
import Button from '../components/Button';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    
    const role = login(email, password);
    
    if (role) {
      setError('');
      if (role === UserRole.ADMIN) navigate('/admin');
      else if (role === UserRole.FACULTY) navigate('/faculty');
      else navigate('/student');
    } else {
      setError('Invalid credentials. Please check your email and password.');
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    // Simulate sending reset link
    setSuccessMessage(`Password reset instructions have been sent to ${email}`);
    setError('');
    // Reset view after a delay or let user click back
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

      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden transition-colors duration-200">
        <div className="bg-indigo-900 dark:bg-slate-950 p-8 text-center relative transition-colors duration-200">
          {isForgotPassword && (
             <button 
               onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
               className="absolute left-4 top-4 text-indigo-200 hover:text-white transition-colors"
             >
               <ArrowLeft size={24} />
             </button>
           )}
          <div className="mx-auto bg-indigo-800 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="text-indigo-200 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isForgotPassword ? 'Reset Password' : 'Welcome Back'}
          </h2>
          <p className="text-indigo-300 mt-2">
            {isForgotPassword ? 'Recover your account access' : 'Sign in to Smart Attendance'}
          </p>
        </div>

        <div className="p-8">
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
                    {error}
                  </div>
                )}
                {successMessage && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-100 dark:border-green-900/50">
                    {successMessage}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    We'll send a password reset link to this email address.
                  </p>
                </div>

                <Button type="submit" className="w-full py-3">
                  Send Reset Link
                </Button>
                
                <div className="text-center mt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMessage(''); }}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    Back to Login
                  </button>
                </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/50">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-1">
                  <button 
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); }}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full py-3">
                Sign In
              </Button>

              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                Don't have an account?{' '}
                <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-500 dark:hover:text-indigo-300">
                  Sign up
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
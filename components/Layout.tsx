import React from 'react';
import { LogOut, LayoutDashboard, User, ShieldCheck, Sun, Moon, QrCode, History, Calendar, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentView = searchParams.get('view') || 'attendance';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string, view?: string) => {
    if (user?.role === UserRole.STUDENT && view) {
      return currentView === view;
    }
    return location.pathname === path;
  };

  const navItemClass = (active: boolean) => 
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active 
        ? 'bg-indigo-800 dark:bg-slate-800 text-white shadow-sm border-l-4 border-indigo-400' 
        : 'text-indigo-100 hover:bg-indigo-800 dark:hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row transition-colors duration-200">
      {/* Sidebar */}
      <aside className="bg-indigo-900 dark:bg-slate-950 text-white w-full md:w-64 flex-shrink-0 transition-colors duration-200 flex flex-col">
        <div className="p-6 border-b border-indigo-800 dark:border-slate-800">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
            Smart Attendance
          </h1>
          <p className="text-xs text-indigo-300 mt-1 uppercase tracking-wider">{user?.role} Portal</p>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          {user?.role === UserRole.STUDENT ? (
            <>
              <Link to="/student?view=attendance" className={navItemClass(currentView === 'attendance')}>
                <QrCode size={20} />
                <span>Mark Attendance</span>
              </Link>
              <Link to="/student?view=history" className={navItemClass(currentView === 'history')}>
                <History size={20} />
                <span>History & Status</span>
              </Link>
              <Link to="/student?view=timetable" className={navItemClass(currentView === 'timetable')}>
                <Calendar size={20} />
                <span>Time Table</span>
              </Link>
              <Link to="/student?view=profile" className={navItemClass(currentView === 'profile')}>
                <UserCircle size={20} />
                <span>Profile</span>
              </Link>
            </>
          ) : (
            <button onClick={() => navigate('/')} className={navItemClass(location.pathname.endsWith('dashboard') || location.pathname === '/')}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
          )}
          
          <div className="border-t border-indigo-800 dark:border-slate-800 my-4 pt-4 md:hidden">
             {/* Mobile only user info in nav */}
             <div className="flex items-center gap-3 px-4 py-2 text-indigo-300 text-sm">
                <User size={16} />
                <span className="truncate">{user?.name}</span>
             </div>
          </div>
        </nav>

        {/* Bottom Actions (Desktop) */}
        <div className="p-4 border-t border-indigo-800 dark:border-slate-800">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 text-indigo-300 text-sm mb-2">
            <User size={16} />
            <span className="truncate">{user?.name}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-300 hover:bg-indigo-800 dark:hover:bg-slate-800 hover:text-red-200 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-slate-800 shadow-sm p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{title}</h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
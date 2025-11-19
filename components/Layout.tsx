import React, { useState } from 'react';
import { LogOut, LayoutDashboard, User, ShieldCheck, Sun, Moon, QrCode, History, Calendar, UserCircle, Users, CheckSquare, Menu, X } from 'lucide-react';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Determine default view based on role
  const defaultView = user?.role === UserRole.STUDENT ? 'attendance' : 'dashboard';
  const currentView = searchParams.get('view') || defaultView;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  const navItemClass = (active: boolean) => 
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active 
        ? 'bg-indigo-800 dark:bg-slate-800 text-white shadow-sm border-l-4 border-indigo-400' 
        : 'text-indigo-100 hover:bg-indigo-800 dark:hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors duration-200 relative overflow-hidden">
      
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 backdrop-blur-sm ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-indigo-900 dark:bg-slate-950 text-white transition-transform duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-auto md:flex flex-shrink-0
      `}>
        <div className="p-6 border-b border-indigo-800 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
              Smart Attendance
            </h1>
            <p className="text-xs text-indigo-300 mt-1 uppercase tracking-wider">{user?.role} Portal</p>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={closeSidebar}
            className="md:hidden text-indigo-300 hover:text-white p-1 rounded-md hover:bg-indigo-800"
          >
            <X size={24} />
          </button>
        </div>
        
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {user?.role === UserRole.STUDENT ? (
            <>
              <Link to="/student?view=attendance" onClick={closeSidebar} className={navItemClass(currentView === 'attendance')}>
                <QrCode size={20} />
                <span>Mark Attendance</span>
              </Link>
              <Link to="/student?view=history" onClick={closeSidebar} className={navItemClass(currentView === 'history')}>
                <History size={20} />
                <span>History & Status</span>
              </Link>
              <Link to="/student?view=timetable" onClick={closeSidebar} className={navItemClass(currentView === 'timetable')}>
                <Calendar size={20} />
                <span>Time Table</span>
              </Link>
              <Link to="/student?view=profile" onClick={closeSidebar} className={navItemClass(currentView === 'profile')}>
                <UserCircle size={20} />
                <span>Profile</span>
              </Link>
            </>
          ) : user?.role === UserRole.FACULTY ? (
            <>
              <Link to="/faculty?view=dashboard" onClick={closeSidebar} className={navItemClass(currentView === 'dashboard')}>
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>
              <Link to="/faculty?view=timetable" onClick={closeSidebar} className={navItemClass(currentView === 'timetable')}>
                <Calendar size={20} />
                <span>Time Table</span>
              </Link>
              <Link to="/faculty?view=students" onClick={closeSidebar} className={navItemClass(currentView === 'students')}>
                <Users size={20} />
                <span>Students</span>
              </Link>
              <Link to="/faculty?view=attendance" onClick={closeSidebar} className={navItemClass(currentView === 'attendance')}>
                <CheckSquare size={20} />
                <span>Attendance</span>
              </Link>
              <Link to="/faculty?view=profile" onClick={closeSidebar} className={navItemClass(currentView === 'profile')}>
                <UserCircle size={20} />
                <span>Profile</span>
              </Link>
            </>
          ) : (
            <button onClick={() => { navigate('/'); closeSidebar(); }} className={navItemClass(location.pathname.endsWith('dashboard') || location.pathname === '/')}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
          )}
          
          <div className="border-t border-indigo-800 dark:border-slate-800 my-4 pt-4 md:hidden">
             {/* Mobile only user info in nav */}
             <div className="flex items-center gap-3 px-4 py-2 text-indigo-300 text-sm">
                <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-indigo-200">
                  <User size={16} />
                </div>
                <span className="truncate font-medium">{user?.name}</span>
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
      <main className="flex-1 flex flex-col min-h-screen w-full overflow-hidden relative">
        <header className="bg-white dark:bg-slate-800 shadow-sm p-4 md:p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 transition-colors duration-200 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-200 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
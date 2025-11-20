
import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, XCircle, CheckCircle, User, AlertCircle } from 'lucide-react';
import { AttendanceAlert } from '../types';

interface AlertsPanelProps {
  alerts: AttendanceAlert[];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;
  const totalCount = alerts.length;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${criticalCount > 0 ? 'bg-red-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 text-[10px] font-bold text-white justify-center items-center ${criticalCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[85vw] sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Bell size={16} className="text-indigo-500"/> Notifications
            </h3>
            <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-600 dark:text-slate-300">
              {totalCount} Alerts
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
                <CheckCircle size={40} className="text-green-500 mb-3 opacity-50" />
                <p className="font-medium">All clear!</p>
                <p className="text-xs mt-1">No attendance alerts at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-l-4 ${
                      alert.type === 'critical' ? 'border-l-red-500' : 'border-l-amber-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${
                        alert.type === 'critical' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                      }`}>
                         {alert.type === 'critical' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                          {alert.studentName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                          {alert.rollNo || 'No Roll No'}
                        </p>
                        <p className={`text-xs font-medium break-words ${
                           alert.type === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {alert.message}
                        </p>
                        <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                           <div 
                              className={`h-1.5 rounded-full ${alert.type === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} 
                              style={{width: `${alert.attendancePercentage}%`}}
                           ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {totalCount > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-center">
               <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <AlertCircle size={12}/> Thresholds: Warning &lt;75%, Critical &lt;60%
               </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;

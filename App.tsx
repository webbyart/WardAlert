
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import NotificationPage from './components/NotificationPage';
import SettingsModal from './components/SettingsModal';
import CalendarPage from './components/CalendarPage';
import { Bed, IVFluid, HighRiskMed, Notification, BedStatus, NotificationStatus, NotificationType, LogEntry } from './types';
import { runAlertScanner, generateIVStartMessage, generateMedStartMessage, generateAdmitMessage, generateDischargeMessage } from './services/alertLogic';
import { sendLineAlertToScript, syncToSheet, fetchInitialData, getScriptUrl } from './services/googleScriptApi';
import { LayoutDashboard, Bell, Globe, Settings, Calendar } from 'lucide-react';
import { Language, translations } from './utils/translations';

const App: React.FC = () => {
  // Global Application State
  const [beds, setBeds] = useState<Bed[]>([]);
  const [ivs, setIvs] = useState<IVFluid[]>([]);
  const [meds, setMeds] = useState<HighRiskMed[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Loading & Sync States
  const [isLoading, setIsLoading] = useState(true); // Initial load
  const [isSyncing, setIsSyncing] = useState(false); // Background sync
  
  // Track last update time
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Settings State
  const [lang, setLang] = useState<Language>('th');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'notifications' | 'calendar'>('dashboard');

  const t = translations[lang];

  // Helper for unique ID
  const getNextId = () => Date.now();
  const getNextNotifId = () => notifications.length > 0 ? Math.max(...notifications.map(n => n.id)) + 1 : 1;
  const getNextLogId = () => logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;

  // --- CORE: Data Fetching Strategy ---
  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    
    // Safety check: ensure we have the URL (which is now hardcoded)
    if (!getScriptUrl()) {
       setIsLoading(false);
       return;
    }

    try {
      const data = await fetchInitialData();
      if (data) {
        // Replace local state with Server State (Single Source of Truth)
        if (data.beds) setBeds(data.beds);
        if (data.ivs) setIvs(data.ivs);
        if (data.meds) setMeds(data.meds);
        if (data.notifications) setNotifications(data.notifications);
        if (data.logs) setLogs(data.logs);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  // 1. Initial Load
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // 2. Realtime Polling (Multi-user Sync) - Runs every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 5000); 
    return () => clearInterval(interval);
  }, [loadData]);

  // Scheduler: Run Alert Scanner Logic locally
  useEffect(() => {
    const runCheck = () => {
      const bedsMap = beds.reduce((acc, bed) => ({ ...acc, [bed.id]: bed.bed_number }), {});
      
      const newAlerts = runAlertScanner(ivs, meds, notifications, bedsMap);
      if (newAlerts.length > 0) {
        setNotifications(prev => [...prev, ...newAlerts]);
        
        // Sync alerts to sheet
        newAlerts.forEach(alert => {
           sendLineAlertToScript(alert);
           syncToSheet('Notifications', 'create', alert);
        });
      }
    };

    if (beds.length > 0) { 
       const interval = setInterval(runCheck, 60000); // Check logic every minute
       return () => clearInterval(interval);
    }
  }, [ivs, meds, notifications, beds]);


  // --- Event Handlers & Sheet Sync ---
  const performSync = async (action: () => Promise<void> | void) => {
    setIsSyncing(true);
    try {
      await action();
      // After action, we trigger a background load to ensure we have latest IDs/state
      setTimeout(() => loadData(true), 1000);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 800);
    }
  };

  // Helper to add Log
  const logActivity = (type: LogEntry['action_type'], details: string) => {
     const newLog: LogEntry = {
        id: getNextLogId(),
        action_type: type,
        details: details,
        timestamp: new Date().toISOString()
     };
     setLogs(prev => [newLog, ...prev]);
     syncToSheet('Logs', 'create', newLog);
  };

  const handleAdmit = (bedId: number, hn: string) => {
    // Optimistic Update
    const updatedBeds = beds.map(b => 
      b.id === bedId ? { ...b, status: BedStatus.OCCUPIED, current_hn: hn } : b
    );
    setBeds(updatedBeds);
    
    // Notification Logic
    const bed = beds.find(b => b.id === bedId);
    const bedNum = bed ? bed.bed_number : 0;
    
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.IV_ALERT,
        hn: hn,
        bed_id: bedId,
        scheduled_at: new Date().toISOString(),
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateAdmitMessage(hn, bedNum),
            target_date: new Date().toISOString()
        }
    };
    setNotifications(prev => [notif, ...prev]);

    // Server Sync
    performSync(() => {
      const updatedBed = updatedBeds.find(b => b.id === bedId);
      if (updatedBed) syncToSheet('Beds', 'update', updatedBed);
      
      syncToSheet('Notifications', 'create', notif);
      sendLineAlertToScript(notif, { 
          customTitle: 'Admit Patient', 
          customColor: '#10b981',
          customDetail: 'Status: Admitted' 
      });

      // Log
      logActivity('ADMIT', `Admitted Patient HN ${hn} to Bed ${bedNum}`);
    });
  };

  const handleDischarge = (bedId: number) => {
    const bed = beds.find(b => b.id === bedId);
    const oldHn = bed?.current_hn || 'Unknown';
    const bedNum = bed ? bed.bed_number : 0;

    // Optimistic Updates
    const updatedBeds = beds.map(b => 
      b.id === bedId ? { ...b, status: BedStatus.VACANT, current_hn: null } : b
    );
    setBeds(updatedBeds);

    const updatedIvs = ivs.map(iv => iv.bed_id === bedId ? { ...iv, is_active: false } : iv);
    setIvs(updatedIvs);

    const updatedMeds = meds.map(m => m.bed_id === bedId ? { ...m, is_active: false } : m);
    setMeds(updatedMeds);

    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.IV_ALERT,
        hn: oldHn,
        bed_id: bedId,
        scheduled_at: new Date().toISOString(),
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateDischargeMessage(oldHn, bedNum),
            target_date: new Date().toISOString()
        }
    };
    setNotifications(prev => [notif, ...prev]);

    performSync(() => {
      syncToSheet('Beds', 'update', { id: bedId, status: 'vacant', current_hn: '' });
      updatedIvs.filter(iv => iv.bed_id === bedId && !iv.is_active && ivs.find(old => old.id === iv.id)?.is_active).forEach(iv => {
        syncToSheet('IVs', 'update', { id: iv.id, is_active: false });
      });
      updatedMeds.filter(m => m.bed_id === bedId && !m.is_active && meds.find(old => old.id === m.id)?.is_active).forEach(m => {
        syncToSheet('Meds', 'update', { id: m.id, is_active: false });
      });

      syncToSheet('Notifications', 'create', notif);
      sendLineAlertToScript(notif, { 
          customTitle: 'Discharged', 
          customColor: '#64748b',
          customDetail: 'Status: Discharged' 
      });

      // Log
      logActivity('DISCHARGE', `Discharged HN ${oldHn} from Bed ${bedNum}`);
    });
  };

  const handleAddIV = (bedId: number, hn: string, type: string, hours: number, startTime: string) => {
    const start = new Date(startTime);
    const due = new Date(start.getTime() + (hours * 60 * 60 * 1000));
    
    const newIV: IVFluid = {
      id: getNextId(),
      hn,
      bed_id: bedId,
      started_at: start.toISOString(),
      due_at: due.toISOString(),
      fluid_type: type,
      is_active: true
    };
    
    setIvs(prev => [...prev, newIV]);

    const bed = beds.find(b => b.id === bedId);
    const bedNum = bed ? bed.bed_number : 0;
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.IV_ALERT,
        hn: hn,
        bed_id: bedId,
        scheduled_at: start.toISOString(),
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateIVStartMessage(hn, bedNum, type, startTime),
            target_date: due.toISOString()
        }
    };
    setNotifications(prev => [notif, ...prev]);

    performSync(() => {
        syncToSheet('IVs', 'create', newIV);
        syncToSheet('Notifications', 'create', notif);
        sendLineAlertToScript(notif, { 
            customTitle: 'New IV Order', 
            customColor: '#0ea5e9',
            customDetail: `Due: ${due.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}` 
        });
        
        // Log
        logActivity('ADD_IV', `Started IV (${type}) for HN ${hn} at Bed ${bedNum}`);
    });
  };

  const handleAddMed = (bedId: number, hn: string, name: string, code: string, startTime: string, expireDate: string) => {
    const newMed: HighRiskMed = {
      id: getNextId(),
      hn,
      bed_id: bedId,
      started_at: new Date(startTime).toISOString(),
      expire_at: new Date(expireDate).toISOString(),
      med_code: code,
      med_name: name,
      is_active: true
    };
    
    setMeds(prev => [...prev, newMed]);

    const bed = beds.find(b => b.id === bedId);
    const bedNum = bed ? bed.bed_number : 0;
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.MED_ALERT,
        hn: hn,
        bed_id: bedId,
        scheduled_at: startTime,
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateMedStartMessage(hn, bedNum, name, startTime),
            target_date: expireDate
        }
    };
    setNotifications(prev => [notif, ...prev]);

    performSync(() => {
        syncToSheet('Meds', 'create', newMed);
        syncToSheet('Notifications', 'create', notif);
        sendLineAlertToScript(notif, { 
            customTitle: 'New Med Order', 
            customColor: '#14b8a6',
            customDetail: `Exp: ${new Date(expireDate).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}` 
        });

        // Log
        logActivity('ADD_MED', `Started Med (${name}) for HN ${hn} at Bed ${bedNum}`);
    });
  };
  
  const handleAddBed = () => {
      const newId = Date.now();
      const nextBedNum = beds.length > 0 ? Math.max(...beds.map(b => b.bed_number)) + 1 : 1;
      const newBed: Bed = {
          id: newId,
          bed_number: nextBedNum,
          status: BedStatus.VACANT,
          current_hn: null
      };
      
      setBeds(prev => [...prev, newBed]);
      performSync(() => {
        syncToSheet('Beds', 'create', newBed);
        logActivity('ADD_BED', `Added Bed #${nextBedNum}`);
      });
  };
  
  const handleUpdateBed = (bedId: number, newNumber: number) => {
      setBeds(prev => prev.map(b => b.id === bedId ? { ...b, bed_number: newNumber } : b));
      performSync(() => {
        syncToSheet('Beds', 'update', { id: bedId, bed_number: newNumber });
        logActivity('UPDATE_BED', `Updated Bed ID ${bedId} to #${newNumber}`);
      });
  };
  
  const handleDeleteBed = (bedId: number) => {
      const bed = beds.find(b => b.id === bedId);
      const bedNum = bed ? bed.bed_number : 0;
      setBeds(prev => prev.filter(b => b.id !== bedId));
      performSync(() => {
         syncToSheet('Beds', 'delete', { id: bedId });
         logActivity('DELETE_BED', `Deleted Bed #${bedNum}`);
      });
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, status: NotificationStatus.SENT } : n 
    ));
    syncToSheet('Notifications', 'update', { id, status: 'sent' });
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'th' ? 'en' : 'th');
  };
  
  // Refresh Handler
  const handleManualRefresh = () => {
      loadData(false);
  };

  const pendingCount = notifications.filter(n => n.status === NotificationStatus.PENDING).length;

  return (
    <div className="flex flex-col h-screen bg-transparent font-sans text-slate-800">
      
      {/* Settings Button (Top Left) */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="fixed top-4 left-4 z-50 bg-white/70 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-teal-100 flex items-center justify-center text-teal-700 hover:text-emerald-600 hover:bg-white transition-all hover:scale-105 active:scale-95 group"
      >
        <Settings size={22} className="group-hover:rotate-45 transition-transform duration-500" />
      </button>

      {/* Floating Language Toggle (Top Right) */}
      <button 
        onClick={toggleLanguage}
        className="fixed top-4 right-4 z-50 bg-white/70 backdrop-blur-md p-2 rounded-full shadow-lg border border-teal-100 flex items-center gap-2 px-3 text-sm font-bold text-teal-700 hover:bg-white transition-all hover:scale-105 active:scale-95"
      >
        <Globe size={18} className="text-teal-500" />
        {lang === 'th' ? 'TH' : 'EN'}
      </button>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'dashboard' ? (
          <Dashboard 
            beds={beds}
            ivs={ivs}
            meds={meds}
            notifications={notifications}
            logs={logs}
            onAdmit={handleAdmit}
            onDischarge={handleDischarge}
            onAddIV={handleAddIV}
            onAddMed={handleAddMed}
            onAddBed={handleAddBed}
            onUpdateBed={handleUpdateBed}
            onDeleteBed={handleDeleteBed}
            isLoading={isLoading || isSyncing}
            lastUpdated={lastUpdated}
            lang={lang}
            onRefresh={handleManualRefresh}
          />
        ) : currentView === 'notifications' ? (
          <div className="h-full overflow-y-auto pb-4">
            <NotificationPage 
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              lang={lang}
            />
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <CalendarPage 
               beds={beds}
               ivs={ivs}
               meds={meds}
               lang={lang}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-xl border-t border-emerald-50 h-[80px] flex justify-around items-center shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-20 pb-safe shrink-0 px-10">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 group ${
              currentView === 'dashboard' ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <div className={`p-2 rounded-2xl transition-all duration-300 ${
              currentView === 'dashboard' ? 'bg-emerald-50 shadow-sm scale-105' : 'group-hover:bg-slate-50'
            }`}>
               <LayoutDashboard size={26} strokeWidth={currentView === 'dashboard' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold tracking-wide">{t.home}</span>
          </button>

          <button
            onClick={() => setCurrentView('calendar')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 group ${
              currentView === 'calendar' ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <div className={`p-2 rounded-2xl transition-all duration-300 ${
              currentView === 'calendar' ? 'bg-indigo-50 shadow-sm scale-105' : 'group-hover:bg-slate-50'
            }`}>
               <Calendar size={26} strokeWidth={currentView === 'calendar' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold tracking-wide">{t.calendar}</span>
          </button>

          <button
            onClick={() => setCurrentView('notifications')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 relative group ${
              currentView === 'notifications' ? 'text-sky-600' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <div className={`p-2 rounded-2xl transition-all duration-300 relative ${
              currentView === 'notifications' ? 'bg-sky-50 shadow-sm scale-105' : 'group-hover:bg-slate-50'
            }`}>
              <Bell size={26} strokeWidth={currentView === 'notifications' ? 2.5 : 2} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform scale-100 animate-pulse-slow">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold tracking-wide">{t.notifications}</span>
          </button>
      </nav>
    </div>
  );
};

export default App;

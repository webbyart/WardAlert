
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import NotificationPage from './components/NotificationPage';
import SettingsModal from './components/SettingsModal';
import CalendarPage from './components/CalendarPage';
import { Bed, IVFluid, HighRiskMed, Notification, BedStatus, NotificationStatus, NotificationType } from './types';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // New state for saving indicator
  
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

  // Load Data from GAS on Mount
  useEffect(() => {
    const loadData = async () => {
      const url = getScriptUrl();
      if (!url) return;
      
      setIsLoading(true);
      const data = await fetchInitialData();
      if (data) {
        setBeds(data.beds || []);
        setIvs(data.ivs || []);
        setMeds(data.meds || []);
        setNotifications(data.notifications || []);
        setLastUpdated(new Date());
      }
      setIsLoading(false);
    };

    loadData();
  }, []); // Run once on mount

  // Scheduler: Run Alert Scanner Logic
  useEffect(() => {
    const runCheck = () => {
      const bedsMap = beds.reduce((acc, bed) => ({ ...acc, [bed.id]: bed.bed_number }), {});
      
      const newAlerts = runAlertScanner(ivs, meds, notifications, bedsMap);
      if (newAlerts.length > 0) {
        setNotifications(prev => [...prev, ...newAlerts]);
        
        // Sync alerts to sheet
        newAlerts.forEach(alert => {
           sendLineAlertToScript(alert); // Uses default Alert Colors (Red/Blue)
           syncToSheet('Notifications', 'create', alert);
        });
      }
    };

    if (beds.length > 0) { 
       runCheck();
       const interval = setInterval(runCheck, 60000);
       return () => clearInterval(interval);
    }
  }, [ivs, meds, notifications, beds]);


  // --- Event Handlers & Sheet Sync ---
  const performSync = async (action: () => Promise<void> | void) => {
    setIsSyncing(true);
    try {
      await action();
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setLastUpdated(new Date());
      }, 800);
    }
  };

  const handleAdmit = (bedId: number, hn: string) => {
    const bed = beds.find(b => b.id === bedId);
    const updatedBeds = beds.map(b => 
      b.id === bedId ? { ...b, status: BedStatus.OCCUPIED, current_hn: hn } : b
    );
    setBeds(updatedBeds);

    // Create Notification & Line Alert
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.IV_ALERT, // Reusing Type for generic msg
        hn: hn,
        bed_id: bedId,
        scheduled_at: new Date().toISOString(),
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateAdmitMessage(hn, bed ? bed.bed_number : 0),
            target_date: new Date().toISOString()
        }
    };
    setNotifications(prev => [notif, ...prev]);

    performSync(() => {
      const updatedBed = updatedBeds.find(b => b.id === bedId);
      if (updatedBed) syncToSheet('Beds', 'update', updatedBed);
      
      // Sync Notification
      syncToSheet('Notifications', 'create', notif);
      sendLineAlertToScript(notif, { 
          customTitle: 'Admit Patient', 
          customColor: '#10b981', // Emerald
          customDetail: 'Status: Admitted' 
      });
    });
  };

  const handleDischarge = (bedId: number) => {
    const bed = beds.find(b => b.id === bedId);
    const oldHn = bed?.current_hn || 'Unknown';

    // 1. Update Bed
    const updatedBeds = beds.map(b => 
      b.id === bedId ? { ...b, status: BedStatus.VACANT, current_hn: null } : b
    );
    setBeds(updatedBeds);

    // 2. Soft Delete IVs
    const updatedIvs = ivs.map(iv => iv.bed_id === bedId ? { ...iv, is_active: false } : iv);
    setIvs(updatedIvs);

    // 3. Soft Delete Meds
    const updatedMeds = meds.map(m => m.bed_id === bedId ? { ...m, is_active: false } : m);
    setMeds(updatedMeds);

    // Create Notification & Line Alert
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.IV_ALERT,
        hn: oldHn,
        bed_id: bedId,
        scheduled_at: new Date().toISOString(),
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateDischargeMessage(oldHn, bed ? bed.bed_number : 0),
            target_date: new Date().toISOString()
        }
    };
    setNotifications(prev => [notif, ...prev]);

    // 4. Perform Syncs
    performSync(() => {
      syncToSheet('Beds', 'update', { id: bedId, status: 'vacant', current_hn: '' });
      updatedIvs.filter(iv => iv.bed_id === bedId && !iv.is_active && ivs.find(old => old.id === iv.id)?.is_active).forEach(iv => {
        syncToSheet('IVs', 'update', { id: iv.id, is_active: false });
      });
      updatedMeds.filter(m => m.bed_id === bedId && !m.is_active && meds.find(old => old.id === m.id)?.is_active).forEach(m => {
        syncToSheet('Meds', 'update', { id: m.id, is_active: false });
      });

      // Sync Notification
      syncToSheet('Notifications', 'create', notif);
      sendLineAlertToScript(notif, { 
          customTitle: 'Discharged', 
          customColor: '#64748b', // Slate
          customDetail: 'Status: Discharged' 
      });
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

    // Create Notification & Line Alert
    const bed = beds.find(b => b.id === bedId);
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.IV_ALERT,
        hn: hn,
        bed_id: bedId,
        scheduled_at: start.toISOString(),
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateIVStartMessage(hn, bed ? bed.bed_number : 0, type, startTime),
            target_date: due.toISOString()
        }
    };
    setNotifications(prev => [notif, ...prev]);

    performSync(() => {
        syncToSheet('IVs', 'create', newIV);
        syncToSheet('Notifications', 'create', notif);
        sendLineAlertToScript(notif, { 
            customTitle: 'New IV Order', 
            customColor: '#0ea5e9', // Sky Blue
            customDetail: `Due: ${due.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}` 
        });
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

    // Create Notification & Line Alert
    const bed = beds.find(b => b.id === bedId);
    const notif: Notification = {
        id: getNextNotifId(),
        type: NotificationType.MED_ALERT,
        hn: hn,
        bed_id: bedId,
        scheduled_at: startTime,
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        payload: {
            message: generateMedStartMessage(hn, bed ? bed.bed_number : 0, name, startTime),
            target_date: expireDate
        }
    };
    setNotifications(prev => [notif, ...prev]);

    performSync(() => {
        syncToSheet('Meds', 'create', newMed);
        syncToSheet('Notifications', 'create', notif);
        sendLineAlertToScript(notif, { 
            customTitle: 'New Med Order', 
            customColor: '#14b8a6', // Teal
            customDetail: `Exp: ${new Date(expireDate).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}` 
        });
    });
  };
  
  // --- Bed CRUD ---
  
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
      performSync(() => syncToSheet('Beds', 'create', newBed));
  };
  
  const handleUpdateBed = (bedId: number, newNumber: number) => {
      setBeds(prev => prev.map(b => b.id === bedId ? { ...b, bed_number: newNumber } : b));
      performSync(() => syncToSheet('Beds', 'update', { id: bedId, bed_number: newNumber }));
  };
  
  const handleDeleteBed = (bedId: number) => {
      setBeds(prev => prev.filter(b => b.id !== bedId));
      performSync(() => syncToSheet('Beds', 'delete', { id: bedId }));
  };

  const handleMarkAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, status: NotificationStatus.SENT } : n 
    ));
    // Optional: Sync notification read status
    // syncToSheet('Notifications', 'update', { id, status: 'sent' });
  };

  const toggleLanguage = () => {
    setLang(prev => prev === 'th' ? 'en' : 'th');
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

      {/* Main Content Area - Takes available space */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'dashboard' ? (
          <Dashboard 
            beds={beds}
            ivs={ivs}
            meds={meds}
            notifications={notifications}
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

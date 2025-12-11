import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import NotificationPage from './components/NotificationPage';
import SettingsModal from './components/SettingsModal';
import { Bed, IVFluid, HighRiskMed, Notification, BedStatus, NotificationStatus } from './types';
// import { mockDB } from './services/mockDatabase'; // REMOVED
import { runAlertScanner } from './services/alertLogic';
import { sendLineAlertToScript, syncToSheet, fetchInitialData, getScriptUrl } from './services/googleScriptApi';
import { LayoutDashboard, Bell, Globe, Settings } from 'lucide-react';
import { Language, translations } from './utils/translations';

const App: React.FC = () => {
  // Global Application State (Start empty)
  const [beds, setBeds] = useState<Bed[]>([]);
  const [ivs, setIvs] = useState<IVFluid[]>([]);
  const [meds, setMeds] = useState<HighRiskMed[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings State
  const [lang, setLang] = useState<Language>('th');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'notifications'>('dashboard');

  const t = translations[lang];

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
        
        newAlerts.forEach(alert => {
           sendLineAlertToScript(alert);
           // Also save notification to sheet
           syncToSheet('Notifications', 'create', alert);
        });
      }
    };

    if (beds.length > 0) { // Only run if we have data
       runCheck();
       const interval = setInterval(runCheck, 60000);
       return () => clearInterval(interval);
    }
  }, [ivs, meds, notifications, beds]);


  // --- Event Handlers & Sheet Sync ---

  const handleAdmit = (bedId: number, hn: string) => {
    setBeds(prev => {
      const updated = prev.map(b => 
        b.id === bedId ? { ...b, status: BedStatus.OCCUPIED, current_hn: hn } : b
      );
      // Sync: Update Bed Status
      const updatedBed = updated.find(b => b.id === bedId);
      if (updatedBed) syncToSheet('Beds', 'update', updatedBed);
      return updated;
    });
  };

  const handleDischarge = (bedId: number) => {
    // 1. Update Bed Status
    setBeds(prev => prev.map(b => 
      b.id === bedId ? { ...b, status: BedStatus.VACANT, current_hn: null } : b
    ));
    // Sync: Update Bed to Vacant
    syncToSheet('Beds', 'update', { id: bedId, status: 'vacant', current_hn: '' });

    // 2. Soft Delete (Deactivate) IVs linked to this bed
    setIvs(prev => {
      const updatedIVs = prev.map(iv => iv.bed_id === bedId ? { ...iv, is_active: false } : iv);
      // Find modified items and sync
      updatedIVs.filter(iv => iv.bed_id === bedId && !iv.is_active).forEach(iv => {
        syncToSheet('IVs', 'update', { id: iv.id, is_active: false });
      });
      return updatedIVs;
    });

    // 3. Soft Delete (Deactivate) Meds linked to this bed
    setMeds(prev => {
      const updatedMeds = prev.map(m => m.bed_id === bedId ? { ...m, is_active: false } : m);
      // Find modified items and sync
      updatedMeds.filter(m => m.bed_id === bedId && !m.is_active).forEach(m => {
        syncToSheet('Meds', 'update', { id: m.id, is_active: false });
      });
      return updatedMeds;
    });
  };

  const handleAddIV = (bedId: number, hn: string, type: string, days: number) => {
    const now = new Date();
    const due = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    const newIV: IVFluid = {
      id: Date.now(),
      hn,
      bed_id: bedId,
      started_at: now.toISOString(),
      due_at: due.toISOString(),
      fluid_type: type,
      is_active: true
    };
    setIvs(prev => [...prev, newIV]);
    // Sync: Create new IV record
    syncToSheet('IVs', 'create', newIV);
  };

  const handleAddMed = (bedId: number, hn: string, name: string, code: string, expireDate: string) => {
    const newMed: HighRiskMed = {
      id: Date.now(),
      hn,
      bed_id: bedId,
      started_at: new Date().toISOString(),
      expire_at: new Date(expireDate).toISOString(),
      med_code: code,
      med_name: name,
      is_active: true
    };
    setMeds(prev => [...prev, newMed]);
    // Sync: Create new Med record
    syncToSheet('Meds', 'create', newMed);
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
      syncToSheet('Beds', 'create', newBed);
  };
  
  const handleUpdateBed = (bedId: number, newNumber: number) => {
      setBeds(prev => prev.map(b => b.id === bedId ? { ...b, bed_number: newNumber } : b));
      syncToSheet('Beds', 'update', { id: bedId, bed_number: newNumber });
  };
  
  const handleDeleteBed = (bedId: number) => {
      setBeds(prev => prev.filter(b => b.id !== bedId));
      syncToSheet('Beds', 'delete', { id: bedId });
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
            isLoading={isLoading}
            lang={lang}
          />
        ) : (
          <div className="h-full overflow-y-auto pb-4">
            <NotificationPage 
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
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
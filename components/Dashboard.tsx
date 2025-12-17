
import React, { useState, useEffect, useMemo } from 'react';
import { Bed, IVFluid, HighRiskMed, Notification, BedStatus, LogEntry } from '../types';
import BedCard from './BedCard';
import HistoryModal from './HistoryModal';
import { UserPlus, Trash2, Droplet, Pill, RefreshCw, Activity, Plus, Settings, Save, X, Cloud, Clock, History, User, FileText, ChevronRight, ChevronLeft, Calendar, Users } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface DashboardProps {
  beds: Bed[];
  ivs: IVFluid[];
  meds: HighRiskMed[];
  notifications: Notification[];
  logs?: LogEntry[];
  lang: Language;
  onAdmit: (bedId: number, hn: string) => void;
  onDischarge: (bedId: number) => void;
  onAddIV: (bedId: number, hn: string, type: string, hours: number, startTime: string) => void;
  onAddMed: (bedId: number, hn: string, name: string, code: string, startTime: string, expireDate: string) => void;
  onAddBed: () => void;
  onUpdateBed: (bedId: number, newNumber: number) => void;
  onDeleteBed: (bedId: number) => void;
  isLoading: boolean;
  lastUpdated: Date | null;
  onRefresh?: () => void;
}

// Helper Type for History Grouping
interface PatientEpisode {
  hn: string;
  admitDate: Date | null;
  dischargeDate: Date | null;
  isCurrent: boolean;
  items: HistoryItem[];
}

interface HistoryItem {
  type: 'IV' | 'MED' | 'LOG';
  data: any;
  timestamp: number;
}

// Extended Bed interface for UI display
interface DisplayBed extends Bed {
  historyCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  beds, ivs, meds, notifications, logs = [], lang, isLoading, lastUpdated,
  onAdmit, onDischarge, onAddIV, onAddMed,
  onAddBed, onUpdateBed, onDeleteBed, onRefresh
}) => {
  const t = translations[lang];

  // UI State
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false); // Global history
  const [activeTab, setActiveTab] = useState<'info' | 'iv' | 'med' | 'history' | 'settings'>('info');

  // History Navigation State
  const [historyView, setHistoryView] = useState<'list' | 'detail'>('list');
  const [selectedHistoryEpisode, setSelectedHistoryEpisode] = useState<PatientEpisode | null>(null);

  // Form States
  const [newHn, setNewHn] = useState('');
  const [ivType, setIvType] = useState('');
  const [ivHours, setIvHours] = useState(24);
  const [ivStartTime, setIvStartTime] = useState('');
  const [medName, setMedName] = useState('');
  const [medCode, setMedCode] = useState('');
  const [medStartTime, setMedStartTime] = useState('');
  const [medExpireDate, setMedExpireDate] = useState('');
  const [editBedNumber, setEditBedNumber] = useState<number>(0);

  const getNowString = () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
  };

  // --- CORE LOGIC 1: Group Beds (Bed-Centric View) ---
  // Ensure one card per bed_number, prioritizing active status
  const groupedBeds = useMemo(() => {
    const map = new Map<number, DisplayBed>();
    
    // Get distinct bed numbers
    const bedNumbers = Array.from(new Set(beds.map(b => b.bed_number)));
    
    bedNumbers.forEach(num => {
       // Find all rows related to this bed number
       const relatedBeds = beds.filter(b => b.bed_number === num);
       
       // Priority: Active Bed > Most Recent Bed Row
       const activeRow = relatedBeds.find(b => b.status === BedStatus.OCCUPIED);
       const displayRow = activeRow || relatedBeds.sort((a,b) => b.id - a.id)[0];

       // Calculate History Count: Unique HNs from Beds + IVS + Meds + Logs linked to this bed #
       const uniqueHns = new Set<string>();
       
       // 1. From Bed Rows
       relatedBeds.forEach(b => { if(b.current_hn) uniqueHns.add(b.current_hn); });
       
       // 2. From Related Items (Match by ID of any row in this group)
       const relatedIds = relatedBeds.map(b => b.id);
       ivs.forEach(i => { if(relatedIds.includes(i.bed_id)) uniqueHns.add(i.hn); });
       meds.forEach(m => { if(relatedIds.includes(m.bed_id)) uniqueHns.add(m.hn); });
       
       // 3. From Logs (Regex match for Bed #)
       logs.forEach(l => {
          if (l.details.includes(`Bed ${num}`) || l.details.includes(`Bed #${num}`) || l.details.includes(`เตียง ${num}`)) {
             const match = l.details.match(/(?:HN|HN:)\s*([A-Za-z0-9-]+)/i);
             if (match) uniqueHns.add(match[1]);
          }
       });

       map.set(num, { ...displayRow, historyCount: uniqueHns.size });
    });

    return Array.from(map.values()).sort((a,b) => a.bed_number - b.bed_number);
  }, [beds, ivs, meds, logs]);


  // Sync internal selectedBed when props change
  useEffect(() => {
    if (selectedBed) {
        // We must find the latest representation of this bed number
        const latestBed = groupedBeds.find(b => b.bed_number === selectedBed.bed_number);
        if (latestBed) {
            setSelectedBed(latestBed);
            setEditBedNumber(latestBed.bed_number);
        }
    }
  }, [groupedBeds, selectedBed?.bed_number]); // Depend on bed_number, not ID

  const getBedAlerts = (bedNum: number) => {
     // Find IDs associated with this bed num
     const relatedIds = beds.filter(b => b.bed_number === bedNum).map(b => b.id);
     return notifications.filter(n => relatedIds.includes(n.bed_id) && n.status === 'pending');
  };

  const handleBedClick = (bed: Bed) => {
    setSelectedBed(bed);
    setEditBedNumber(bed.bed_number);
    setShowModal(true);
    setActiveTab('info');
    setHistoryView('list');
    setSelectedHistoryEpisode(null);
    
    // Reset forms
    const nowStr = getNowString();
    setNewHn('');
    setIvType('');
    setIvHours(24);
    setIvStartTime(nowStr);
    setMedName('');
    setMedCode('');
    setMedStartTime(nowStr);
    setMedExpireDate('');
  };

  // --- Actions (Using current selectedBed.id which is the ACTIVE row ID) ---
  const submitAdmit = () => {
    if (selectedBed && newHn) onAdmit(selectedBed.id, newHn);
  };
  const submitDischarge = () => {
    if (selectedBed) { onDischarge(selectedBed.id); setShowModal(false); }
  };
  const submitAddIV = () => {
    if (selectedBed && selectedBed.current_hn) {
      onAddIV(selectedBed.id, selectedBed.current_hn, ivType, ivHours, ivStartTime);
      setActiveTab('info');
    }
  };
  const submitAddMed = () => {
    if (selectedBed && selectedBed.current_hn) {
      onAddMed(selectedBed.id, selectedBed.current_hn, medName, medCode, medStartTime, medExpireDate);
      setActiveTab('info');
    }
  };
  const submitEditBed = () => {
    if (selectedBed && editBedNumber > 0) {
        onUpdateBed(selectedBed.id, editBedNumber);
        setActiveTab('info');
    }
  };
  const submitDeleteBed = () => {
      if (selectedBed && confirm(t.confirmDeleteBed)) {
          onDeleteBed(selectedBed.id);
          setShowModal(false);
      }
  };

  // --- CORE LOGIC 2: Bed-Centric History Grouping ---
  const patientEpisodes = useMemo(() => {
    if (!selectedBed) return [];

    // KEY CHANGE: Aggregate based on Bed Number, not just Bed ID
    const targetBedNum = selectedBed.bed_number;
    const relatedBedIds = beds.filter(b => b.bed_number === targetBedNum).map(b => b.id);
    
    // 1. Identify all HNs associated with this Bed Number
    const hns = new Set<string>();
    
    // From current/past bed rows
    beds.filter(b => b.bed_number === targetBedNum && b.current_hn).forEach(b => hns.add(b.current_hn!));

    // From Logs (Regex match)
    const relevantLogs = logs.filter(l => 
        l.details.includes(`Bed ${targetBedNum}`) || 
        l.details.includes(`เตียง ${targetBedNum}`) ||
        l.details.includes(`Bed #${targetBedNum}`)
    );
    const hnRegex = /(?:HN|HN:)\s*([A-Za-z0-9-]+)/i;
    relevantLogs.forEach(l => {
        const match = l.details.match(hnRegex);
        if (match && match[1]) hns.add(match[1]);
    });

    // From items
    ivs.filter(i => relatedBedIds.includes(i.bed_id)).forEach(i => hns.add(i.hn));
    meds.filter(m => relatedBedIds.includes(m.bed_id)).forEach(m => hns.add(m.hn));

    // 2. Construct Episodes
    const episodes: PatientEpisode[] = [];

    hns.forEach(hn => {
        const items: HistoryItem[] = [];

        // Collect Items
        relevantLogs.filter(l => l.details.includes(hn)).forEach(l => {
            items.push({ type: 'LOG', data: l, timestamp: new Date(l.timestamp).getTime() });
        });
        ivs.filter(i => i.hn === hn && relatedBedIds.includes(i.bed_id)).forEach(i => {
            items.push({ type: 'IV', data: i, timestamp: new Date(i.started_at).getTime() });
        });
        meds.filter(m => m.hn === hn && relatedBedIds.includes(m.bed_id)).forEach(m => {
            items.push({ type: 'MED', data: m, timestamp: new Date(m.started_at).getTime() });
        });

        if (items.length > 0) {
            items.sort((a, b) => b.timestamp - a.timestamp); // Newest first

            // Try to find admit/discharge dates from logs
            const admitLog = relevantLogs.find(l => l.action_type === 'ADMIT' && l.details.includes(hn));
            const dischargeLog = relevantLogs.find(l => l.action_type === 'DISCHARGE' && l.details.includes(hn));
            
            // Fallbacks
            let startDate = admitLog ? new Date(admitLog.timestamp) : null;
            if (!startDate && items.length > 0) startDate = new Date(items[items.length-1].timestamp);

            let endDate = dischargeLog ? new Date(dischargeLog.timestamp) : null;
            
            // Is this the currently active patient on the active bed row?
            const isCurrent = selectedBed.status === BedStatus.OCCUPIED && selectedBed.current_hn === hn;

            episodes.push({
                hn,
                admitDate: startDate,
                dischargeDate: endDate,
                isCurrent,
                items
            });
        }
    });

    // Sort: Current > Recent Admission Date
    return episodes.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return (b.admitDate?.getTime() || 0) - (a.admitDate?.getTime() || 0);
    });

  }, [selectedBed, beds, logs, ivs, meds]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Global History Modal */}
      <HistoryModal 
        isOpen={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)}
        logs={logs}
        lang={lang}
      />

      {/* Header */}
      <header className="h-20 bg-white/40 backdrop-blur-md border-b border-white/50 flex items-center justify-between px-6 shadow-sm sticky top-0 z-10 transition-all">
        <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight drop-shadow-sm flex items-center gap-2">
                <div className="bg-gradient-to-tr from-emerald-400 to-sky-400 p-2 rounded-lg text-white shadow-lg shadow-emerald-200">
                    <Activity size={20} />
                </div>
                {t.dashboardTitle}
            </h1>
            <p className="text-xs text-slate-500 font-medium ml-1 mt-1 opacity-80">Ward Monitoring System</p>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all shadow-sm hover:shadow-md"
              >
                  <History size={14} />
                  <span className="hidden sm:inline">{lang === 'th' ? 'ประวัติรวม' : 'Global Log'}</span>
              </button>

              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border shadow-sm transition-all duration-300 
                ${isLoading ? 'bg-sky-50 text-sky-600 border-sky-100 cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 cursor-pointer hover:shadow-md'}`}
              >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Cloud size={14} />
                      <span>{t.liveUpdates}</span>
                    </>
                  )}
              </button>
          </div>
          
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-mono font-medium tracking-tight mr-1">
              {t.lastUpdated}: {lastUpdated.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {/* Bed Grid (Using groupedBeds) */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 scrollbar-hide">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {groupedBeds.map(bed => (
            <BedCard 
              key={bed.bed_number} // Use bed_number as key for stability
              bed={bed} 
              historyCount={bed.historyCount}
              lang={lang}
              onClick={handleBedClick} 
              hasAlert={getBedAlerts(bed.bed_number).length > 0}
            />
          ))}
          
          <button 
            onClick={onAddBed}
            className="rounded-[24px] border-[2px] border-dashed border-slate-300 bg-slate-50/50 hover:bg-white hover:border-emerald-400 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group min-h-[160px] shadow-sm hover:shadow-lg"
          >
            <div className="bg-white p-4 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <Plus size={32} className="text-slate-400 group-hover:text-emerald-500" />
            </div>
            <span className="font-bold text-slate-400 group-hover:text-emerald-600">{t.addBed}</span>
          </button>
        </div>
      </div>

      {/* BED MODAL */}
      {showModal && selectedBed && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden ring-4 ring-white/50 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className={`
                p-6 text-white flex justify-between items-center shadow-md relative overflow-hidden shrink-0
                ${selectedBed.status === BedStatus.OCCUPIED ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}
            `}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              
              <div className="relative z-10">
                 <div className="flex items-center gap-2 text-white/80 text-sm font-bold uppercase tracking-wider mb-1">
                    <Settings size={14} /> {t.manageBed}
                 </div>
                 <h3 className="text-3xl font-mono font-bold tracking-tighter flex items-center gap-2">
                    {t.bed} {selectedBed.bed_number}
                 </h3>
              </div>
              
              <div className="flex gap-2 relative z-10">
                 <button onClick={() => setActiveTab('settings')} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-all backdrop-blur-md">
                   <Settings size={20} />
                 </button>
                 <button onClick={() => setShowModal(false)} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-all backdrop-blur-md">
                   <X size={20} />
                 </button>
              </div>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0 overflow-x-auto">
                <button 
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 min-w-[80px] py-4 text-sm font-bold tracking-wide transition-all ${activeTab === 'info' ? 'text-slate-800 border-b-2 border-slate-800 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}
                >
                  {t.info}
                </button>
                <button 
                  disabled={selectedBed.status === BedStatus.VACANT}
                  onClick={() => setActiveTab('iv')}
                  className={`flex-1 min-w-[80px] py-4 text-sm font-bold tracking-wide transition-all ${activeTab === 'iv' ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/30' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50/30 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400'}`}
                >
                  + {t.addIV}
                </button>
                <button 
                  disabled={selectedBed.status === BedStatus.VACANT}
                  onClick={() => setActiveTab('med')}
                  className={`flex-1 min-w-[80px] py-4 text-sm font-bold tracking-wide transition-all ${activeTab === 'med' ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/30' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50/30 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400'}`}
                >
                  + {t.addMed}
                </button>
                <button 
                  onClick={() => { setActiveTab('history'); setHistoryView('list'); }}
                  className={`flex-1 min-w-[80px] py-4 text-sm font-bold tracking-wide transition-all ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/30' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/30'}`}
                >
                  {t.history}
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-0 bg-white overflow-y-auto flex-1 relative">
                
                {/* 1. INFO TAB */}
                {activeTab === 'info' && (
                  <div className="p-8 space-y-4 animate-fade-in-up">
                    {selectedBed.status === BedStatus.VACANT ? (
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-10 rounded-3xl border border-emerald-100 text-center shadow-inner">
                        <div className="bg-white w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100">
                           <UserPlus size={48} className="text-emerald-400" />
                        </div>
                        <h4 className="text-xl font-bold text-emerald-800 mb-8">{t.vacant}</h4>
                        <div className="flex gap-3 max-w-sm mx-auto">
                          <input
                            type="text"
                            placeholder={t.specifyHN}
                            className="flex-1 px-5 py-3 border-2 border-emerald-100 rounded-2xl focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100/50 outline-none text-emerald-900 placeholder:text-emerald-300 bg-white transition-all shadow-sm"
                            value={newHn}
                            onChange={(e) => setNewHn(e.target.value)}
                          />
                          <button
                            onClick={submitAdmit}
                            disabled={!newHn}
                            className="bg-emerald-500 text-white px-6 py-3 rounded-2xl hover:bg-emerald-600 disabled:opacity-50 font-bold shadow-lg shadow-emerald-200 transition-all transform hover:scale-105 active:scale-95"
                          >
                            {t.admit}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-white to-transparent opacity-50"></div>
                          <div>
                            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-1 block">{t.patientHN}</span>
                            <div className="text-4xl font-mono font-bold text-slate-700 tracking-tighter">{selectedBed.current_hn}</div>
                          </div>
                          <button
                            onClick={submitDischarge}
                            className="relative z-10 text-rose-500 bg-white border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md"
                          >
                            <Trash2 size={18} /> {t.discharge}
                          </button>
                        </div>

                        <div className="grid gap-4">
                          <div className="bg-sky-50/50 p-5 rounded-2xl border border-sky-100">
                            <h5 className="font-bold text-sky-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                              <span className="bg-sky-200 p-1.5 rounded-lg text-sky-700"><Droplet size={14} fill="currentColor"/></span> 
                              {t.activeIVs}
                            </h5>
                            <div className="space-y-2.5">
                              {ivs.filter(i => i.bed_id === selectedBed.id && i.is_active).length === 0 ? (
                                <p className="text-sm text-sky-400/70 italic bg-white/60 p-4 rounded-xl text-center border border-dashed border-sky-200">{t.noItems}</p>
                              ) : (
                                ivs.filter(i => i.bed_id === selectedBed.id && i.is_active).map(iv => (
                                  <div key={iv.id} className="text-sm p-3 bg-white rounded-xl border border-sky-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-center">
                                       <span className="font-bold text-slate-600">{iv.fluid_type}</span>
                                       <span className="text-sky-600 font-mono text-xs bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100 font-bold">
                                         {t.dueAt} {new Date(iv.due_at).toLocaleDateString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}
                                       </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                       <Clock size={10} /> {t.startedAt} {new Date(iv.started_at).toLocaleString('th-TH')}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100">
                            <h5 className="font-bold text-rose-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                               <span className="bg-rose-200 p-1.5 rounded-lg text-rose-700"><Pill size={14} fill="currentColor"/></span>
                               {t.activeMeds}
                            </h5>
                            <div className="space-y-2.5">
                              {meds.filter(m => m.bed_id === selectedBed.id && m.is_active).length === 0 ? (
                                <p className="text-sm text-rose-400/70 italic bg-white/60 p-4 rounded-xl text-center border border-dashed border-rose-200">{t.noItems}</p>
                              ) : (
                                meds.filter(m => m.bed_id === selectedBed.id && m.is_active).map(m => (
                                  <div key={m.id} className="text-sm p-3 bg-white rounded-xl border border-rose-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-center">
                                       <span className="font-bold text-slate-600">{m.med_name} <span className="text-slate-400 font-normal">({m.med_code})</span></span>
                                       <span className="text-rose-600 font-mono text-xs bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 font-bold">
                                          {t.expiredAt} {new Date(m.expire_at).toLocaleDateString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}
                                       </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                       <Clock size={10} /> {t.startedAt} {new Date(m.started_at).toLocaleString('th-TH')}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. IV TAB */}
                {activeTab === 'iv' && (
                  <div className="p-8 space-y-6 animate-fade-in-up">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-sky-100 p-3 rounded-full text-sky-600"><Droplet size={24}/></div>
                        <h4 className="font-bold text-slate-700 text-xl">{t.addIV}</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.ivType}</label>
                        <input 
                          className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-sky-300 focus:ring-4 focus:ring-sky-100 focus:bg-white outline-none transition-all"
                          placeholder={t.exampleIV}
                          value={ivType}
                          onChange={e => setIvType(e.target.value)}
                        />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.ivStartTime}</label>
                         <input 
                            type="datetime-local"
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-sky-300 focus:ring-4 focus:ring-sky-100 focus:bg-white outline-none transition-all"
                            value={ivStartTime}
                            onChange={e => setIvStartTime(e.target.value)}
                         />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.ivDuration}</label>
                        <div className="relative">
                          <input 
                            type="number"
                            min="1"
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-sky-300 focus:ring-4 focus:ring-sky-100 focus:bg-white outline-none transition-all"
                            value={ivHours}
                            onChange={e => setIvHours(Number(e.target.value))}
                          />
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{t.hoursUnit}</span>
                        </div>
                      </div>
                      <button onClick={submitAddIV} disabled={!ivType || !ivStartTime} className="w-full bg-sky-500 text-white py-4 rounded-2xl font-bold hover:bg-sky-600 disabled:opacity-50 shadow-xl shadow-sky-200 transition-all transform active:scale-95 mt-4">
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. MED TAB */}
                {activeTab === 'med' && (
                  <div className="p-8 space-y-6 animate-fade-in-up">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-rose-100 p-3 rounded-full text-rose-600"><Pill size={24}/></div>
                        <h4 className="font-bold text-slate-700 text-xl">{t.addMed}</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.medName}</label>
                        <input className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all" placeholder={t.exampleMed} value={medName} onChange={e => setMedName(e.target.value)}/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.medCode}</label>
                            <input className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all" placeholder="MED-XXX" value={medCode} onChange={e => setMedCode(e.target.value)}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.medStartTime}</label>
                            <input type="datetime-local" className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all" value={medStartTime} onChange={e => setMedStartTime(e.target.value)}/>
                        </div>
                      </div>
                      <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.expireDate}</label>
                            <input type="datetime-local" className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all" value={medExpireDate} onChange={e => setMedExpireDate(e.target.value)}/>
                      </div>
                      <button onClick={submitAddMed} disabled={!medName || !medExpireDate || !medStartTime} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 disabled:opacity-50 shadow-xl shadow-rose-200 transition-all transform active:scale-95 mt-4">
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* 4. HISTORY TAB (Bed-Centric) */}
                {activeTab === 'history' && (
                  <div className="h-full flex flex-col bg-slate-50/50">
                    
                    {/* VIEW A: LIST OF PATIENTS FOR THIS BED NUMBER */}
                    {historyView === 'list' && (
                       <div className="p-8 space-y-4 animate-fade-in-up">
                            <h4 className="font-bold text-slate-700 text-lg mb-4 flex items-center gap-2">
                                <History size={20} className="text-slate-400" /> 
                                {t.history} 
                                <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{patientEpisodes.length}</span>
                            </h4>

                            {patientEpisodes.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                    {t.noHistory}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {patientEpisodes.map((episode, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => { setSelectedHistoryEpisode(episode); setHistoryView('detail'); }}
                                            className={`
                                                relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md group
                                                ${episode.isCurrent ? 'bg-white border-emerald-200 shadow-sm' : 'bg-white border-slate-200 opacity-90 hover:opacity-100'}
                                            `}
                                        >
                                            {episode.isCurrent && (
                                                <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-bl-xl rounded-tr-xl">
                                                    ACTIVE
                                                </div>
                                            )}
                                            
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${episode.isCurrent ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        <User size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-lg tracking-tight">HN: {episode.hn}</div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Calendar size={12} />
                                                            {episode.admitDate ? episode.admitDate.toLocaleDateString('th-TH') : 'Unknown'} 
                                                            {' - '}
                                                            {episode.dischargeDate ? episode.dischargeDate.toLocaleDateString('th-TH') : (episode.isCurrent ? 'Present' : '...')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="text-slate-300 group-hover:text-slate-600" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                       </div>
                    )}

                    {/* VIEW B: DETAIL TIMELINE FOR SPECIFIC PATIENT */}
                    {historyView === 'detail' && selectedHistoryEpisode && (
                        <div className="flex flex-col h-full animate-fade-in-up">
                            {/* Sub-header */}
                            <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-4 shadow-sm z-10 sticky top-0">
                                <button onClick={() => setHistoryView('list')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <ChevronLeft size={20} className="text-slate-600"/>
                                </button>
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Patient History</div>
                                    <div className="font-bold text-slate-800 text-xl font-mono">HN: {selectedHistoryEpisode.hn}</div>
                                </div>
                            </div>

                            {/* Timeline Content */}
                            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="border-l-2 border-slate-200 ml-3 space-y-6">
                                    {selectedHistoryEpisode.items.map((item, idx) => (
                                        <div key={idx} className="relative pl-8 group">
                                            {/* Dot */}
                                            <div className={`
                                                absolute -left-[9px] top-3 w-4 h-4 rounded-full border-[3px] border-white shadow-sm z-10
                                                ${item.type === 'IV' ? 'bg-sky-400' : item.type === 'MED' ? 'bg-rose-400' : 'bg-slate-400'}
                                            `}></div>

                                            <div className={`
                                                p-4 rounded-xl border shadow-sm transition-all
                                                ${item.type === 'IV' ? 'bg-white border-sky-100 hover:border-sky-300' : 
                                                  item.type === 'MED' ? 'bg-white border-rose-100 hover:border-rose-300' : 
                                                  'bg-slate-50 border-slate-200'}
                                            `}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2">
                                                        {item.type === 'IV' && <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded text-[10px] font-bold">IV FLUID</span>}
                                                        {item.type === 'MED' && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold">MEDICATION</span>}
                                                        {item.type === 'LOG' && <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">SYSTEM LOG</span>}
                                                        
                                                        <span className="text-[10px] font-mono text-slate-400">
                                                            {new Date(item.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="font-bold text-slate-700 text-sm">
                                                    {item.type === 'IV' ? item.data.fluid_type : 
                                                     item.type === 'MED' ? item.data.med_name : 
                                                     item.data.details}
                                                </div>

                                                {/* Expanded Details */}
                                                {(item.type === 'IV' || item.type === 'MED') && (
                                                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="block text-[9px] uppercase text-slate-400 font-bold">Started</span>
                                                            {new Date(item.data.started_at).toLocaleString('th-TH')}
                                                        </div>
                                                        <div>
                                                            <span className="block text-[9px] uppercase text-slate-400 font-bold">
                                                                {item.type === 'IV' ? 'Due' : 'Expire'}
                                                            </span>
                                                            {new Date(item.type === 'IV' ? item.data.due_at : item.data.expire_at).toLocaleString('th-TH')}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                  </div>
                )}
                
                {/* 5. SETTINGS TAB */}
                {activeTab === 'settings' && (
                  <div className="p-8 space-y-6 animate-fade-in-up">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-slate-100 p-3 rounded-full text-slate-600"><Settings size={24}/></div>
                        <h4 className="font-bold text-slate-700 text-xl">{t.manageBed}</h4>
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.bedNumber}</label>
                            <input 
                                type="number"
                                className="w-full border-2 border-slate-200 bg-white rounded-xl p-4 font-mono font-bold text-lg text-center"
                                value={editBedNumber}
                                onChange={(e) => setEditBedNumber(Number(e.target.value))}
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                             <button onClick={submitEditBed} className="bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 flex items-center justify-center gap-2">
                                <Save size={18} /> {t.saveChanges}
                             </button>
                             <button onClick={() => setActiveTab('info')} className="bg-white text-slate-600 border border-slate-200 py-3 rounded-xl font-bold hover:bg-slate-50">
                                {t.cancel}
                             </button>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-6">
                        <button onClick={submitDeleteBed} className="w-full bg-rose-50 text-rose-600 border border-rose-100 py-4 rounded-xl font-bold hover:bg-rose-100 flex items-center justify-center gap-2 transition-colors">
                           <Trash2 size={18} /> {t.deleteBed}
                        </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

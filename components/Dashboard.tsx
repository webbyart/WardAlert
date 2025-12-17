
import React, { useState, useEffect } from 'react';
import { Bed, IVFluid, HighRiskMed, Notification, BedStatus, LogEntry } from '../types';
import BedCard from './BedCard';
import HistoryModal from './HistoryModal';
import { UserPlus, Trash2, Droplet, Pill, RefreshCw, Activity, Plus, Settings, Save, X, Cloud, Clock, History } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface DashboardProps {
  beds: Bed[];
  ivs: IVFluid[];
  meds: HighRiskMed[];
  notifications: Notification[];
  logs?: LogEntry[]; // New Prop
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

const Dashboard: React.FC<DashboardProps> = ({ 
  beds, ivs, meds, notifications, logs = [], lang, isLoading, lastUpdated,
  onAdmit, onDischarge, onAddIV, onAddMed,
  onAddBed, onUpdateBed, onDeleteBed, onRefresh
}) => {
  const t = translations[lang];

  // UI State for Modal only
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'iv' | 'med' | 'history' | 'settings'>('info');

  // Form States
  const [newHn, setNewHn] = useState('');
  
  // IV Form
  const [ivType, setIvType] = useState('');
  const [ivHours, setIvHours] = useState(24); // Default 1 day
  const [ivStartTime, setIvStartTime] = useState('');

  // Med Form
  const [medName, setMedName] = useState('');
  const [medCode, setMedCode] = useState('');
  const [medStartTime, setMedStartTime] = useState('');
  const [medExpireDate, setMedExpireDate] = useState('');
  
  // Bed Edit State
  const [editBedNumber, setEditBedNumber] = useState<number>(0);

  // Helper to format Date for input[type="datetime-local"]
  const getNowString = () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
  };

  // Update modal state when selectedBed changes from outside (e.g., discharge updates status)
  useEffect(() => {
    if (selectedBed) {
        const latestBed = beds.find(b => b.id === selectedBed.id);
        if (latestBed) {
            setSelectedBed(latestBed);
            setEditBedNumber(latestBed.bed_number);
        }
    }
  }, [beds, selectedBed?.id]);

  // Helper: Get alerts for a specific bed
  const getBedAlerts = (bedId: number) => {
    return notifications.filter(n => n.bed_id === bedId && n.status === 'pending');
  };

  const handleBedClick = (bed: Bed) => {
    setSelectedBed(bed);
    setEditBedNumber(bed.bed_number);
    setShowModal(true);
    setActiveTab('info');
    
    // Reset forms with defaults
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

  const submitAdmit = () => {
    if (selectedBed && newHn) {
      onAdmit(selectedBed.id, newHn);
    }
  };

  const submitDischarge = () => {
    if (selectedBed) {
      onDischarge(selectedBed.id);
      setShowModal(false);
    }
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
      if (selectedBed) {
          if (confirm(t.confirmDeleteBed)) {
              onDeleteBed(selectedBed.id);
              setShowModal(false);
          }
      }
  };

  // History filtering
  const getHistoryIVs = (bedId: number) => ivs.filter(i => i.bed_id === bedId && !i.is_active).sort((a,b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime());
  const getHistoryMeds = (bedId: number) => meds.filter(m => m.bed_id === bedId && !m.is_active).sort((a,b) => new Date(b.expire_at).getTime() - new Date(a.expire_at).getTime());

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
              {/* History Log Button */}
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all shadow-sm hover:shadow-md"
              >
                  <History size={14} />
                  <span className="hidden sm:inline">{lang === 'th' ? 'ประวัติ' : 'History'}</span>
              </button>

              {/* Manual Refresh Button */}
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

      {/* Bed Grid */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 scrollbar-hide">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {beds.sort((a,b) => a.bed_number - b.bed_number).map(bed => (
            <BedCard 
              key={bed.id} 
              bed={bed} 
              lang={lang}
              onClick={handleBedClick} 
              hasAlert={getBedAlerts(bed.id).length > 0}
            />
          ))}
          
          {/* Add Bed Button */}
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

      {/* Modal - Detail/Action */}
      {showModal && selectedBed && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden ring-4 ring-white/50 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className={`
                p-6 text-white flex justify-between items-center shadow-md relative overflow-hidden shrink-0
                ${selectedBed.status === BedStatus.OCCUPIED ? 'bg-gradient-to-r from-sky-400 to-blue-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}
            `}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              
              <h3 className="text-xl font-bold flex items-center gap-3 relative z-10">
                 <span className="bg-white/20 px-3 py-1 rounded-full text-sm backdrop-blur-sm shadow-sm border border-white/10">{t.manageBed}</span> 
                 <span className="text-3xl font-mono tracking-tighter">{selectedBed.bed_number}</span>
              </h3>
              
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
              {/* Tabs */}
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
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 min-w-[80px] py-4 text-sm font-bold tracking-wide transition-all ${activeTab === 'history' ? 'text-slate-600 border-b-2 border-slate-500 bg-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}
                >
                  {t.history}
                </button>
              </div>

              <div className="p-8 bg-white overflow-y-auto flex-1">
                {activeTab === 'info' && (
                  <div className="space-y-4 animate-fade-in-up">
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

                        {/* Lists of Active Items */}
                        <div className="grid gap-4">
                          {/* Active IVs - Blue Theme */}
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

                          {/* Active Meds - Red Theme (Kept Red for Safety/Alert meaning) */}
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

                {activeTab === 'iv' && (
                  <div className="space-y-6 animate-fade-in-up">
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
                      
                      {/* NEW: Start Time */}
                      <div>
                         <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.ivStartTime}</label>
                         <input 
                            type="datetime-local"
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-sky-300 focus:ring-4 focus:ring-sky-100 focus:bg-white outline-none transition-all"
                            value={ivStartTime}
                            onChange={e => setIvStartTime(e.target.value)}
                         />
                      </div>

                      {/* UPDATED: Hours instead of Days Select */}
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
                        <div className="flex gap-2 mt-2">
                           <button onClick={() => setIvHours(24)} className="text-xs bg-slate-100 hover:bg-sky-100 text-slate-600 px-3 py-1 rounded-lg">1 Day</button>
                           <button onClick={() => setIvHours(72)} className="text-xs bg-slate-100 hover:bg-sky-100 text-slate-600 px-3 py-1 rounded-lg">3 Days</button>
                           <button onClick={() => setIvHours(168)} className="text-xs bg-slate-100 hover:bg-sky-100 text-slate-600 px-3 py-1 rounded-lg">7 Days</button>
                        </div>
                      </div>

                      <button 
                        onClick={submitAddIV}
                        disabled={!ivType || !ivStartTime}
                        className="w-full bg-sky-500 text-white py-4 rounded-2xl font-bold hover:bg-sky-600 disabled:opacity-50 shadow-xl shadow-sky-200 transition-all transform active:scale-95 mt-4"
                      >
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'med' && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-rose-100 p-3 rounded-full text-rose-600"><Pill size={24}/></div>
                        <h4 className="font-bold text-slate-700 text-xl">{t.addMed}</h4>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.medName}</label>
                        <input 
                          className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all"
                          placeholder={t.exampleMed}
                          value={medName}
                          onChange={e => setMedName(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.medCode}</label>
                            <input 
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all"
                            placeholder="MED-XXX"
                            value={medCode}
                            onChange={e => setMedCode(e.target.value)}
                            />
                        </div>
                        {/* NEW: Start Time */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.medStartTime}</label>
                            <input 
                            type="datetime-local"
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all"
                            value={medStartTime}
                            onChange={e => setMedStartTime(e.target.value)}
                            />
                        </div>
                      </div>
                      
                      <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-wider">{t.expireDate}</label>
                            <input 
                            type="datetime-local"
                            className="w-full border-2 border-slate-100 bg-slate-50/50 rounded-2xl p-4 text-sm focus:border-rose-300 focus:ring-4 focus:ring-rose-100 focus:bg-white outline-none transition-all"
                            value={medExpireDate}
                            onChange={e => setMedExpireDate(e.target.value)}
                            />
                      </div>
                      
                      <button 
                        onClick={submitAddMed}
                        disabled={!medName || !medExpireDate || !medStartTime}
                        className="w-full bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 disabled:opacity-50 shadow-xl shadow-rose-200 transition-all transform active:scale-95 mt-4"
                      >
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* NEW: History Tab */}
                {activeTab === 'history' && (
                  <div className="space-y-6 animate-fade-in-up">
                     <div className="flex items-center gap-3 mb-2">
                        <div className="bg-slate-100 p-3 rounded-full text-slate-600"><History size={24}/></div>
                        <h4 className="font-bold text-slate-700 text-xl">{t.history}</h4>
                    </div>

                    {getHistoryIVs(selectedBed.id).length === 0 && getHistoryMeds(selectedBed.id).length === 0 ? (
                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                            {t.noHistory}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {getHistoryIVs(selectedBed.id).length > 0 && (
                                <div>
                                    <h5 className="font-bold text-sky-800 mb-3 text-sm uppercase tracking-wider">{t.activeIVs} (Old)</h5>
                                    <div className="space-y-2">
                                        {getHistoryIVs(selectedBed.id).map(iv => (
                                            <div key={iv.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-700 text-sm">{iv.fluid_type}</span>
                                                        <span className="text-[10px] font-mono text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200">
                                                            HN: {iv.hn}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                        <span>Start: {new Date(iv.started_at).toLocaleString('th-TH')}</span>
                                                        <span>End: {new Date(iv.due_at).toLocaleString('th-TH')}</span>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border shadow-sm">Finished</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                             {getHistoryMeds(selectedBed.id).length > 0 && (
                                <div>
                                    <h5 className="font-bold text-rose-800 mb-3 text-sm uppercase tracking-wider">{t.activeMeds} (Old)</h5>
                                    <div className="space-y-2">
                                        {getHistoryMeds(selectedBed.id).map(m => (
                                            <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                                                <div>
                                                     <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-700 text-sm">{m.med_name}</span>
                                                        <span className="text-[10px] font-mono text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">
                                                            HN: {m.hn}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                                                        <span>Start: {new Date(m.started_at).toLocaleString('th-TH')}</span>
                                                        <span>Exp: {new Date(m.expire_at).toLocaleString('th-TH')}</span>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border shadow-sm">Expired</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'settings' && (
                  <div className="space-y-6 animate-fade-in-up">
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

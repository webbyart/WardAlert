
import React from 'react';
import { LogEntry } from '../types';
import { X, Clock, UserPlus, Trash2, Droplet, Pill, History, Edit, Bed } from 'lucide-react';
import { Language } from '../utils/translations';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  lang: Language;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, logs, lang }) => {
  if (!isOpen) return null;

  // Sort newest first
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getIcon = (type: string) => {
    switch (type) {
      case 'ADMIT': return <UserPlus size={18} className="text-emerald-600" />;
      case 'DISCHARGE': return <Trash2 size={18} className="text-rose-600" />;
      case 'ADD_IV': return <Droplet size={18} className="text-sky-600" />;
      case 'ADD_MED': return <Pill size={18} className="text-teal-600" />;
      case 'ADD_BED': return <Bed size={18} className="text-slate-600" />;
      case 'UPDATE_BED': return <Edit size={18} className="text-indigo-600" />;
      default: return <History size={18} className="text-slate-500" />;
    }
  };

  const getColors = (type: string) => {
     switch (type) {
      case 'ADMIT': return 'bg-emerald-50 border-emerald-100';
      case 'DISCHARGE': return 'bg-rose-50 border-rose-100';
      case 'ADD_IV': return 'bg-sky-50 border-sky-100';
      case 'ADD_MED': return 'bg-teal-50 border-teal-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in-up">
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-800 p-6 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-3 text-white">
            <div className="bg-white/10 p-2 rounded-xl">
               <History size={24} className="text-slate-200" />
            </div>
            {lang === 'th' ? 'ประวัติการทำงาน' : 'Activity Logs'}
          </h3>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {sortedLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>{lang === 'th' ? 'ยังไม่มีรายการประวัติ' : 'No history logs found'}</p>
                </div>
            ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 py-2">
                    {sortedLogs.map((log) => (
                        <div key={log.id} className="relative pl-8">
                            {/* Dot */}
                            <div className="absolute -left-[9px] top-3 w-4 h-4 rounded-full border-[3px] border-white bg-slate-300 shadow-sm z-10"></div>
                            
                            {/* Card */}
                            <div className={`p-4 rounded-2xl border ${getColors(log.action_type)} shadow-sm`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100">
                                            {getIcon(log.action_type)}
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
                                            {log.action_type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                                        <Clock size={10} />
                                        {new Date(log.timestamp).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' })}
                                    </span>
                                </div>
                                <p className="text-slate-700 text-sm font-medium leading-snug">
                                    {log.details}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 border-t border-slate-100">
            {lang === 'th' ? 'แสดงประวัติย้อนหลังทั้งหมด' : 'Showing all activity logs'}
        </div>

      </div>
    </div>
  );
};

export default HistoryModal;

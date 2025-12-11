import React from 'react';
import { Bed, BedStatus } from '../types';
import { User, Bed as BedIcon, AlertCircle, Plus } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface BedCardProps {
  bed: Bed;
  onClick: (bed: Bed) => void;
  hasAlert: boolean;
  lang: Language;
}

const BedCard: React.FC<BedCardProps> = ({ bed, onClick, hasAlert, lang }) => {
  const isOccupied = bed.status === BedStatus.OCCUPIED;
  const t = translations[lang];

  return (
    <div
      onClick={() => onClick(bed)}
      className={`
        relative overflow-hidden rounded-[24px] cursor-pointer transition-all duration-300 group
        border-[1.5px] shadow-sm hover:shadow-xl hover:-translate-y-1
        ${isOccupied 
          ? 'bg-gradient-to-br from-sky-50 to-white border-sky-100 hover:border-sky-300 hover:shadow-sky-100/60' 
          : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/60'
        }
      `}
    >
      {/* Header Status Pill */}
      <div className="flex justify-between items-start p-4 pb-0 relative z-10">
        <span className={`
          text-xs font-bold px-3 py-1.5 rounded-full tracking-wide flex items-center gap-1 shadow-sm
          ${isOccupied ? 'bg-white text-sky-600 border border-sky-100' : 'bg-white text-emerald-600 border border-emerald-100'}
        `}>
          <div className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-sky-500' : 'bg-emerald-500'}`}></div>
          {t.bed} {bed.bed_number}
        </span>
        
        {hasAlert && (
          <span className="absolute right-4 top-4 animate-bounce text-amber-500 drop-shadow-sm bg-white rounded-full p-1 border border-amber-100">
            <AlertCircle size={20} fill="#f59e0b" className="text-white" />
          </span>
        )}
      </div>

      {/* Main Content Area with Stylized Bed */}
      <div className="flex flex-col items-center justify-center pt-2 pb-6 px-4 relative h-36">
        
        {/* Background Blob */}
        <div className={`
          absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full blur-2xl opacity-40 transition-colors duration-500
          ${isOccupied ? 'bg-sky-200' : 'bg-emerald-200'}
        `}></div>

        {/* Beautiful Bed Visualization */}
        <div className="relative z-10 mt-2 group-hover:scale-105 transition-transform duration-300">
           {isOccupied ? (
             <div className="relative">
                {/* Bed Frame */}
                <div className="bg-sky-100 p-3 rounded-2xl border-2 border-sky-200 shadow-sm relative">
                   <BedIcon size={40} className="text-sky-400" strokeWidth={1.5} />
                </div>
                {/* Patient Overlay */}
                <div className="absolute -right-2 -top-2 bg-white p-1.5 rounded-full border-2 border-sky-100 shadow-md">
                   <div className="bg-sky-500 rounded-full p-1">
                      <User size={16} className="text-white" />
                   </div>
                </div>
             </div>
           ) : (
             <div className="relative">
               <div className="bg-emerald-100/50 p-3 rounded-2xl border-2 border-emerald-100/50 border-dashed group-hover:border-emerald-300 transition-colors">
                  <BedIcon size={40} className="text-emerald-300 group-hover:text-emerald-500 transition-colors" strokeWidth={1.5} />
               </div>
               <div className="absolute -right-2 -top-2 bg-white p-1.5 rounded-full border-2 border-emerald-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="bg-emerald-400 rounded-full p-1">
                      <Plus size={16} className="text-white" />
                   </div>
               </div>
             </div>
           )}
        </div>

        {/* Text Info */}
        <div className="mt-4 text-center z-10">
          {isOccupied ? (
            <>
              <div className="font-mono font-bold text-lg text-slate-700 tracking-tight leading-none">{bed.current_hn}</div>
              <div className="text-[10px] uppercase font-bold text-sky-400 mt-1 tracking-wider">{t.occupied}</div>
            </>
          ) : (
            <>
              <div className="font-bold text-sm text-emerald-400/80 tracking-wide mt-1">{t.vacant}</div>
            </>
          )}
        </div>

      </div>
      
      {/* Decorative Bottom Bar */}
      <div className={`h-1.5 w-full ${isOccupied ? 'bg-sky-400' : 'bg-emerald-400/50'}`}></div>
    </div>
  );
};

export default BedCard;
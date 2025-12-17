
import React, { useState, useMemo } from 'react';
import { Bed, IVFluid, HighRiskMed } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Droplet, Pill } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface CalendarPageProps {
  beds: Bed[];
  ivs: IVFluid[];
  meds: HighRiskMed[];
  lang: Language;
}

type EventType = 'iv-start' | 'iv-due' | 'med-start' | 'med-expire';

interface CalendarEvent {
  id: string;
  date: Date;
  type: EventType;
  hn: string;
  bed_number: number;
  label: string;
  detail: string;
}

const CalendarPage: React.FC<CalendarPageProps> = ({ beds, ivs, meds, lang }) => {
  const t = translations[lang];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Helper Map for Bed Numbers
  const bedMap = useMemo(() => {
    return beds.reduce((acc, b) => ({ ...acc, [b.id]: b.bed_number }), {} as Record<number, number>);
  }, [beds]);

  // Generate Events
  const events = useMemo(() => {
    const list: CalendarEvent[] = [];

    ivs.forEach(iv => {
      const bedNum = bedMap[iv.bed_id] || 0;
      // Start Event
      list.push({
        id: `iv-s-${iv.id}`,
        date: new Date(iv.started_at),
        type: 'iv-start',
        hn: iv.hn,
        bed_number: bedNum,
        label: iv.fluid_type,
        detail: t.ivStart
      });
      // Due Event
      list.push({
        id: `iv-e-${iv.id}`,
        date: new Date(iv.due_at),
        type: 'iv-due',
        hn: iv.hn,
        bed_number: bedNum,
        label: iv.fluid_type,
        detail: t.ivDue
      });
    });

    meds.forEach(med => {
      const bedNum = bedMap[med.bed_id] || 0;
      // Start Event
      list.push({
        id: `m-s-${med.id}`,
        date: new Date(med.started_at),
        type: 'med-start',
        hn: med.hn,
        bed_number: bedNum,
        label: med.med_name,
        detail: t.medStart
      });
      // Expire Event
      list.push({
        id: `m-e-${med.id}`,
        date: new Date(med.expire_at),
        type: 'med-expire',
        hn: med.hn,
        bed_number: bedNum,
        label: med.med_name,
        detail: t.medExpire
      });
    });

    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [ivs, meds, bedMap, t]);

  // Get events for specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(e => 
      e.date.getDate() === date.getDate() &&
      e.date.getMonth() === date.getMonth() &&
      e.date.getFullYear() === date.getFullYear()
    );
  };

  // Calendar Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Calendar Grid Generation
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const selectedEvents = getEventsForDate(selectedDate);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
       {/* Header */}
       <header className="h-20 bg-white/40 backdrop-blur-md border-b border-white/50 flex items-center justify-between px-6 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 shadow-sm">
                <CalendarIcon size={20} />
            </div>
            {t.calendarTitle}
        </h1>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-6">
        
        {/* Left: Calendar Grid */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-6 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft /></button>
                <h2 className="text-xl font-bold text-slate-700">
                    {lang === 'th' ? thaiMonths[currentDate.getMonth()] : monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + (lang === 'th' ? 543 : 0)}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight /></button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2 flex-1">
                {blanksArray.map(b => <div key={`blank-${b}`} className="aspect-square"></div>)}
                
                {daysArray.map(day => {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dayEvents = getEventsForDate(date);
                    const isSelected = date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();
                    const hasIv = dayEvents.some(e => e.type.includes('iv'));
                    const hasMed = dayEvents.some(e => e.type.includes('med'));

                    return (
                        <div 
                            key={day} 
                            onClick={() => setSelectedDate(date)}
                            className={`
                                aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all relative border
                                ${isSelected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200 border-indigo-500 scale-105 z-10' : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-100 hover:shadow-md'}
                                ${isToday && !isSelected ? 'border-indigo-400 border-2' : ''}
                            `}
                        >
                            <span className="text-sm font-bold">{day}</span>
                            
                            {/* Dots indicators */}
                            <div className="flex gap-1 mt-1">
                                {hasIv && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-sky-200' : 'bg-sky-400'}`}></div>}
                                {hasMed && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-rose-200' : 'bg-rose-400'}`}></div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Right: Event List */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-6 w-full md:w-96 flex flex-col h-full overflow-hidden">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2 border-b pb-4">
                 <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-500 text-sm">
                    {selectedDate.getDate()} {lang === 'th' ? thaiMonths[selectedDate.getMonth()] : monthNames[selectedDate.getMonth()]}
                 </span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {selectedEvents.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        {t.noEvents}
                    </div>
                ) : (
                    selectedEvents.map(event => (
                        <div key={event.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1
                                    ${event.type.includes('iv') ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}
                                `}>
                                    {event.type.includes('iv') ? <Droplet size={10} /> : <Pill size={10} />}
                                    {event.detail}
                                </div>
                                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                    <Clock size={10} />
                                    {event.date.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            <div className="font-bold text-slate-700">{event.label}</div>
                            <div className="flex justify-between items-end mt-2">
                                <span className="text-xs text-slate-500">HN: {event.hn}</span>
                                <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-600">
                                    {t.bed} {event.bed_number}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default CalendarPage;

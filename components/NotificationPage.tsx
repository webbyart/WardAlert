import React from 'react';
import { Notification, NotificationType, NotificationStatus } from '../types';
import { AlertTriangle, CheckCircle, Clock, BellRing } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface NotificationPageProps {
  notifications: Notification[];
  onMarkAsRead: (id: number) => void;
  lang: Language;
}

const NotificationPage: React.FC<NotificationPageProps> = ({ notifications, onMarkAsRead, lang }) => {
  const t = translations[lang];

  // Sort: Pending first, then by date (newest first)
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.status === NotificationStatus.PENDING && b.status !== NotificationStatus.PENDING) return -1;
    if (a.status !== NotificationStatus.PENDING && b.status === NotificationStatus.PENDING) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-bold text-teal-900 flex items-center gap-3 drop-shadow-sm">
          <div className="bg-amber-100 p-2 rounded-xl">
             <BellRing className="text-amber-500" size={28} />
          </div>
          {t.notificationCenter}
        </h1>
      </header>

      <div className="space-y-4">
        {sortedNotifications.length === 0 ? (
          <div className="text-center py-20 bg-white/60 backdrop-blur rounded-3xl border border-teal-100 shadow-sm">
            <div className="bg-emerald-50 w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="text-emerald-400" size={40} />
            </div>
            <p className="text-slate-500 text-lg font-medium">{t.noNotifications}</p>
          </div>
        ) : (
          sortedNotifications.map(note => (
            <div 
              key={note.id} 
              className={`
                relative p-6 rounded-2xl border shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 bg-white
                ${note.type === NotificationType.IV_ALERT ? 'border-sky-200 shadow-sky-100/50' : 'border-rose-200 shadow-rose-100/50'}
                ${note.status === NotificationStatus.PENDING ? 'opacity-100 ring-1 ring-offset-2 ring-offset-transparent' : 'opacity-60 grayscale-[0.5]'}
                ${note.status === NotificationStatus.PENDING && note.type === NotificationType.IV_ALERT ? 'ring-sky-200' : ''}
                ${note.status === NotificationStatus.PENDING && note.type === NotificationType.MED_ALERT ? 'ring-rose-200' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    note.type === NotificationType.IV_ALERT ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {note.type === NotificationType.IV_ALERT ? 'IV Fluid Alert' : 'High-Risk Med Alert'}
                  </span>
                  <span className="flex items-center text-slate-400 text-xs gap-1 font-medium bg-slate-50 px-2 py-1 rounded">
                    <Clock size={12} />
                    {new Date(note.created_at).toLocaleString('th-TH')}
                  </span>
                </div>
                {note.status === NotificationStatus.PENDING ? (
                  <button 
                    onClick={() => onMarkAsRead(note.id)}
                    className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-sm font-bold transition-colors shadow-sm"
                  >
                    {t.markRead}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 text-sm font-bold px-3 py-1 bg-emerald-50 rounded-lg">
                    <CheckCircle size={16} /> {t.read}
                  </span>
                )}
              </div>
              
              <div className="mt-2 pl-1">
                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="font-mono text-slate-500 text-base">HN:</span> {note.hn} 
                  <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full ml-2">{t.bed} {note.bed_id}</span>
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {note.payload.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPage;
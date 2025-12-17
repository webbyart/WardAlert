
import React, { useState, useEffect } from 'react';
import { testConnection, sendLineAlertToScript, triggerSetup, seedDatabase } from '../services/googleScriptApi';
import { Language, translations } from '../utils/translations';
import { NotificationType } from '../types';
import { Settings, CheckCircle, AlertCircle, Send, Database, FileSpreadsheet, Copy, Code, Server, CloudLightning, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

// THE FIXED GOOGLE APPS SCRIPT CODE TO DISPLAY
const GOOGLE_APPS_SCRIPT_CODE = `
// *** COPY THIS CODE TO GOOGLE APPS SCRIPT ***

const LINE_TOKEN = 'YOUR_LINE_TOKEN_HERE'; 
const LINE_GROUP_ID = 'YOUR_GROUP_ID_HERE';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'setup') {
    setupDatabase();
    return responseJSON({ status: 'success', message: 'Database setup complete' });
  }
  return responseJSON({ status: 'success', message: 'Service is running' });
}

function doPost(e) {
  try {
    let body = {};
    if (e.postData && e.postData.contents) {
       try { body = JSON.parse(e.postData.contents); } catch(ex) { body = {}; }
    }
    
    const action = body.action;

    if (action === 'read_all') {
      const data = readAllTables();
      return responseJSON({ status: 'success', data: data });
    }

    if (action === 'send_line') {
      if (!body.payload) return responseJSON({status:'error'});
      sendLineFlexMessage(body.payload);
      return responseJSON({status: 'success'});
    } 
    
    if (action === 'sync') {
      handleSync(body.sheet, body.operation, body.data);
      return responseJSON({status: 'success'});
    }
    
    if (action === 'seed') {
      seedDatabaseWithMockData();
      return responseJSON({status: 'success'});
    }

    if (action === 'test_connection') {
       return responseJSON({ status: 'success' });
    }

    return responseJSON({ status: 'error', message: 'Unknown action' });

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

// --- Read Logic ---
function readAllTables() {
  return {
    beds: readSheet('Beds'),
    ivs: readSheet('IVs'),
    meds: readSheet('Meds'),
    notifications: readSheet('Notifications'),
    logs: readSheet('Logs') // Added Logs
  };
}

function readSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => {
       // Convert numbers if possible, but keep string for HN
       let val = row[i];
       if (h === 'id' || h === 'bed_id' || h === 'bed_number') val = Number(val);
       // Handle checkbox/boolean
       if (h === 'is_active') val = (val === true || val === 'TRUE');
       obj[h] = val;
    });
    return obj;
  });
}

// --- Database Logic ---
function handleSync(sheetName, operation, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
     // Auto-create if missing (failsafe)
     if (sheetName === 'Logs') {
        sheet = ss.insertSheet('Logs');
        sheet.appendRow(['id', 'action_type', 'details', 'timestamp']);
     } else {
        return;
     }
  }

  if (sheet.getLastRow() === 0) { const keys = Object.keys(data); sheet.appendRow(keys); }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (operation === 'create') {
    const row = headers.map(h => data[h] === undefined ? '' : data[h]);
    sheet.appendRow(row);
  } else if (operation === 'update' || operation === 'delete') {
    const id = data.id;
    const dataRange = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < dataRange.length; i++) {
      if (String(dataRange[i][0]) === String(id)) { rowIndex = i + 1; break; }
    }
    if (rowIndex > -1) {
      if (operation === 'delete') { sheet.deleteRow(rowIndex); }
      else {
         const currentRow = dataRange[rowIndex - 1];
         const newRow = headers.map((h, i) => data.hasOwnProperty(h) ? data[h] : currentRow[i]);
         sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
      }
    }
  }
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schemas = {
    'Beds': ['id', 'bed_number', 'status', 'current_hn'],
    'IVs': ['id', 'hn', 'bed_id', 'started_at', 'due_at', 'fluid_type', 'is_active'],
    'Meds': ['id', 'hn', 'bed_id', 'started_at', 'expire_at', 'med_code', 'med_name', 'is_active'],
    'Notifications': ['id', 'type', 'hn', 'bed_id', 'status', 'created_at', 'message'],
    'Logs': ['id', 'action_type', 'details', 'timestamp'] // Added Logs Schema
  };
  Object.keys(schemas).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(schemas[name]); sheet.setFrozenRows(1); }
  });
}

function seedDatabaseWithMockData() {
  setupDatabase(); // Ensure sheets exist
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Clear and Seed Beds
  const bedSheet = ss.getSheetByName('Beds');
  if (bedSheet.getLastRow() > 1) bedSheet.deleteRows(2, bedSheet.getLastRow() - 1);
  const beds = [];
  for(let i=1; i<=8; i++) {
     const occupied = [1,2,4,5,8].includes(i);
     beds.push([i, i, occupied ? 'occupied' : 'vacant', occupied ? 'HN-'+(1000+i) : '']);
  }
  if(beds.length > 0) bedSheet.getRange(2, 1, beds.length, 4).setValues(beds);
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function sendLineFlexMessage(data) {
  const { title='Alert', message='-', hn='Unknown', bed='-', detail='-', color='#000' } = data;
  const payload = {
    to: LINE_GROUP_ID,
    messages: [{
      "type": "flex", "altText": title,
      "contents": { "type": "bubble", 
        "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": title, "weight": "bold", "color": "#FFF" }], "backgroundColor": color },
        "body": { "type": "box", "layout": "vertical", "contents": [
           { "type": "text", "text": "HN: " + hn + " (Bed "+bed+")", "weight": "bold" },
           { "type": "text", "text": message, "wrap": true, "size": "sm" }
        ]}
      }
    }]
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    'method': 'post',
    'headers': { 'Authorization': 'Bearer ' + LINE_TOKEN, 'Content-Type': 'application/json' },
    'payload': JSON.stringify(payload)
  });
}
`;

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [msg, setMsg] = useState('');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setMsg('');
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setStatus('loading');
    setMsg('Testing connection...');
    try {
      const res = await testConnection();
      if (res) {
        setStatus('success');
        setMsg('Connection Successful!');
      } else {
        throw new Error('Failed');
      }
    } catch (e) {
      setStatus('error');
      setMsg('Connection Failed. Check URL.');
    }
  };

  const handleSetupSheet = async () => {
    setStatus('loading');
    setMsg('Initializing Sheets...');
    try {
      await triggerSetup();
      setStatus('success');
      setMsg('Setup command sent.');
    } catch (e) {
      setStatus('error');
      setMsg('Failed to setup.');
    }
  };

  const handleSeedData = async () => {
    setStatus('loading');
    setMsg('Seeding sample data...');
    try {
      await seedDatabase();
      setStatus('success');
      setMsg('Sample data added to Sheets!');
    } catch (e) {
      setStatus('error');
      setMsg('Failed to seed data.');
    }
  };

  const handleTestLine = async () => {
    setStatus('loading');
    setMsg('Sending test message...');
    const testAlert = {
      id: 999,
      type: NotificationType.IV_ALERT,
      hn: 'TEST-SYSTEM',
      bed_id: 0,
      scheduled_at: new Date().toISOString(),
      status: 'pending' as any,
      created_at: new Date().toISOString(),
      payload: {
        message: 'This is a test message from WardAlert System.',
        target_date: new Date().toISOString()
      }
    };
    await sendLineAlertToScript(testAlert);
    setStatus('success');
    setMsg('Test message sent!');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setMsg('Code copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 transition-all duration-300">
      <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-6 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
              <Settings size={28} className="text-cyan-100" />
              {t.settings}
            </h3>
            <p className="text-cyan-100 text-sm mt-1 opacity-90">{t.connectDB}</p>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-all">✕</button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 flex-1">
          
          {/* Connection Info */}
          <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl flex items-start gap-3">
             <ShieldCheck className="text-sky-500 shrink-0 mt-0.5" size={20} />
             <div>
                <h4 className="font-bold text-sky-900 text-sm mb-1">Secure Connection Active</h4>
                <p className="text-xs text-sky-700 leading-relaxed">
                   The system is permanently connected to the designated Google Sheet. Data is synchronized automatically.
                </p>
             </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
             <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
             <div>
                <h4 className="font-bold text-amber-900 text-sm mb-1">Important Update</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                   For the "History Log" feature to work, you must update your Google Apps Script code with the new version below (it adds a "Logs" table).
                </p>
             </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Connection */}
            <button 
              onClick={handleTestConnection} 
              className="group relative overflow-hidden bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-4 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-indigo-100 transition-all duration-300 hover:scale-[1.03] hover:opacity-100 active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600 group-hover:scale-110 transition-transform"><CloudLightning size={20}/></div>
                <span className="font-bold text-indigo-900">{t.testConn}</span>
              </div>
              <p className="text-xs text-indigo-400">Ping the server to check availability</p>
            </button>

            {/* Test LINE */}
            <button 
              onClick={handleTestLine} 
              className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-white border border-green-100 p-4 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-green-100 transition-all duration-300 hover:scale-[1.03] hover:opacity-100 active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-100 p-2 rounded-lg text-green-600 group-hover:scale-110 transition-transform"><Send size={20}/></div>
                <span className="font-bold text-green-900">{t.testLine}</span>
              </div>
              <p className="text-xs text-green-400">Send a dummy alert to LINE Group</p>
            </button>

            {/* Setup Sheet */}
            <button 
              onClick={handleSetupSheet} 
              className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-white border border-amber-100 p-4 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-amber-100 transition-all duration-300 hover:scale-[1.03] hover:opacity-100 active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-amber-100 p-2 rounded-lg text-amber-600 group-hover:scale-110 transition-transform"><FileSpreadsheet size={20}/></div>
                <span className="font-bold text-amber-900">{t.setupSheet}</span>
              </div>
              <p className="text-xs text-amber-400">Initialize columns in empty sheet</p>
            </button>

            {/* Seed Data */}
            <button 
              onClick={handleSeedData} 
              className="group relative overflow-hidden bg-gradient-to-br from-pink-50 to-white border border-pink-100 p-4 rounded-2xl shadow-sm hover:shadow-lg hover:shadow-pink-100 transition-all duration-300 hover:scale-[1.03] hover:opacity-100 active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-pink-100 p-2 rounded-lg text-pink-600 group-hover:scale-110 transition-transform"><Server size={20}/></div>
                <span className="font-bold text-pink-900">{t.seedData}</span>
              </div>
              <p className="text-xs text-pink-400">Populate sheet with sample data</p>
            </button>
          </div>

          {/* Status Message */}
          {msg && (
            <div className={`p-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm animate-fade-in-up ${status === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              {status === 'loading' && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>}
              {msg}
            </div>
          )}

          {/* Code Section */}
          <div className="border-t border-slate-100 pt-6">
            <button 
              onClick={() => setShowCode(!showCode)}
              className="w-full flex items-center justify-between text-slate-500 hover:text-cyan-600 transition-colors"
            >
              <span className="flex items-center gap-2 font-bold text-sm"><Code size={18}/> {t.viewCode}</span>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded">{showCode ? 'Hide' : 'Show'}</span>
            </button>

            {showCode && (
              <div className="mt-4 animate-fade-in-up">
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-t-xl flex gap-3 text-xs text-amber-800">
                  <AlertCircle size={16} className="shrink-0 text-amber-500"/>
                  {t.setupInstructions}
                </div>
                <div className="relative bg-slate-800 rounded-b-xl overflow-hidden">
                  <button 
                    onClick={copyToClipboard}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all"
                    title={t.copyCode}
                  >
                    <Copy size={16}/>
                  </button>
                  <pre className="p-4 text-[10px] text-slate-300 font-mono overflow-x-auto h-64 custom-scrollbar">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

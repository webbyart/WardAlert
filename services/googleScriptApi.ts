
import { Notification, NotificationType } from '../types';

// *** CONSTANT: The Specific Web App URL provided ***
const FIXED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySc6hcwSsHRLErMIX1VrQhsH3amZIlL0uP5MhB1IUEN5_HXeydfs1a68et5KQ3hBPE/exec';

export const saveScriptUrl = (url: string) => {
  // Deprecated: URL is now fixed.
  console.log('URL saving is disabled in this version. Using fixed URL.');
};

export const getScriptUrl = () => {
  // Always return the fixed URL
  return FIXED_SCRIPT_URL;
};

// Helper to send robust requests to GAS
const sendToGas = async (payload: any) => {
  const url = getScriptUrl();
  
  // Debug Payload
  if (payload.action === 'send_line') {
     console.log('--- SENDING LINE PAYLOAD TO GAS ---');
     console.log(JSON.stringify(payload, null, 2));
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors', 
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const jsonResponse = await response.json();

    // Debug Response from GAS
    if (payload.action === 'send_line') {
       console.log('--- GAS RESPONSE ---');
       console.log(jsonResponse);
    }

    return jsonResponse;

  } catch (error) {
    console.error('Error sending to GAS:', error);
    // Rethrow error so UI knows something went wrong
    throw error;
  }
};

export const testConnection = async () => {
  const url = getScriptUrl();
  try {
     await fetch(`${url}?action=test`, { mode: 'no-cors' });
     return true;
  } catch(e) {
     return false;
  }
};

export const triggerSetup = async () => {
  const url = getScriptUrl();
  try {
    await fetch(`${url}?action=setup`, { mode: 'no-cors' });
  } catch (e) {
    console.error('Setup trigger failed', e);
  }
};

export const seedDatabase = async () => {
  try {
    await sendToGas({ action: 'seed' });
  } catch(e) {
    console.error("Seed failed", e);
  }
};

export const fetchInitialData = async () => {
  try {
    const result = await sendToGas({ action: 'read_all' });
    if (result && result.status === 'success') {
      return result.data;
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch data', e);
    return null;
  }
};

// --- CRUD Operations ---
export type SyncOperation = 'create' | 'update' | 'delete';

export const syncToSheet = async (sheetName: string, operation: SyncOperation, data: any) => {
  try {
    console.log(`Syncing to ${sheetName} [${operation}]...`);
    await sendToGas({
      action: 'sync',
      sheet: sheetName,
      operation: operation,
      data: data
    });
    console.log(`Sync success: ${sheetName}`);
  } catch (e) {
    console.error(`Failed to sync data to ${sheetName}`, e);
  }
};

interface LineOptions {
    customTitle?: string;
    customColor?: string;
    customDetail?: string;
}

// --- LINE Alert ---
export const sendLineAlertToScript = async (notification: Notification, options?: LineOptions) => {
  const isIV = notification.type === NotificationType.IV_ALERT;
  
  // Format dates for friendly display
  const targetDate = new Date(notification.payload.target_date);
  const dateStr = targetDate.toLocaleDateString('th-TH');
  const timeStr = targetDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  // Default Mapping based on NotificationType
  let type = isIV ? 'iv' : 'med';
  let title = isIV ? 'IV Fluid Alert' : 'High-Risk Med Alert';
  // Note: color is now handled by GAS based on 'type', but we keep logic just in case
  let detail = isIV 
      ? `Due: ${dateStr} ${timeStr}` 
      : `Expire: ${dateStr} ${timeStr}`;

  // Override if Custom Options provided (e.g. from App.tsx Admit/Discharge/New Orders)
  if (options?.customTitle) {
      title = options.customTitle;
      
      // Heuristic to map Custom Titles to correct GAS Theme Type
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('admit') || lowerTitle.includes('discharge') || lowerTitle.includes('bed')) {
          type = 'bed';
      } else if (lowerTitle.includes('iv')) {
          type = 'iv';
      } else if (lowerTitle.includes('med')) {
          type = 'med';
      }
  }
  
  if (options?.customDetail) detail = options.customDetail;

  const linePayload = {
    type: type, // New required field for GAS Theme
    title: title,
    message: notification.payload.message,
    hn: notification.hn,
    bed: notification.bed_id,
    detail: detail
  };

  try {
    // Return the response so caller can check for success/failure
    return await sendToGas({
      action: 'send_line',
      payload: linePayload
    });
  } catch (e) {
    console.error('Failed to send LINE', e);
    throw e;
  }
};

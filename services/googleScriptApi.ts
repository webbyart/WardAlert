
import { Notification, NotificationType } from '../types';

// *** CONSTANT: The Specific Web App URL provided ***
const FIXED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx7k__DGVgZ_xBbLezmvtMRIP1RxuS1hzu1bN9mL44MkycThm8CsK5KWUF8EeipEcou/exec';

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
  
  const isRead = payload.action === 'read_all';
  
  // Use 'cors' mode to allow reading the response (needed for read_all)
  try {
    const response = await fetch(url, {
      method: 'POST',
      // 'cors' is required to read the response body from GAS
      mode: 'cors', 
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
      },
      body: JSON.stringify(payload)
    });

    if (isRead) {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    }
  } catch (error) {
    console.error('Error sending to GAS:', error);
    if (isRead) throw error; // Rethrow for reads so UI knows it failed
  }
};

export const testConnection = async () => {
  const url = getScriptUrl();
  try {
     // We use a simple fetch to check if the script endpoint is reachable
     // Note: mode 'no-cors' is used for simple pings where we don't need the body,
     // but to be sure the app works, we usually rely on 'read_all' working.
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
    // console.log('Fetching fresh data from Sheet...');
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

  // Determine Title and Color
  let title = isIV ? 'IV Fluid Alert' : 'High-Risk Med Alert';
  let color = isIV ? '#3b82f6' : '#ef4444'; // Blue-500 : Red-500
  let detail = isIV 
      ? `Due: ${dateStr} ${timeStr}` 
      : `Expire: ${dateStr} ${timeStr}`;

  // Override if Custom Options provided (For Actions like "Start IV")
  if (options?.customTitle) title = options.customTitle;
  if (options?.customColor) color = options.customColor;
  if (options?.customDetail) detail = options.customDetail;

  const linePayload = {
    title: title,
    color: color,
    message: notification.payload.message,
    hn: notification.hn,
    bed: notification.bed_id,
    detail: detail
  };

  try {
    await sendToGas({
      action: 'send_line',
      payload: linePayload
    });
  } catch (e) {
    console.error('Failed to send LINE', e);
  }
};

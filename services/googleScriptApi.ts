import { Notification, NotificationType } from '../types';

// Default URL to ensure connection works across devices and refreshes immediately
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwkhn-4_SKTHvVFV-JDYgcQVFvgh7-bwErxZSu_MHPiQ2bh8s80WXPHGiyPOxY6GR8/exec';

export const saveScriptUrl = (url: string) => {
  localStorage.setItem('wardAlert_scriptUrl', url);
};

export const getScriptUrl = () => {
  const stored = localStorage.getItem('wardAlert_scriptUrl');
  // Use stored URL if available, otherwise fall back to the default hardcoded URL
  return (stored && stored.trim() !== '') ? stored : DEFAULT_SCRIPT_URL;
};

// Helper to send robust requests to GAS
const sendToGas = async (payload: any) => {
  const url = getScriptUrl();
  if (!url) throw new Error('No URL configured');

  const isRead = payload.action === 'read_all';
  
  // Use 'cors' mode to allow reading the response (needed for read_all)
  try {
    const response = await fetch(url, {
      method: 'POST',
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
    throw error;
  }
};

export const testConnection = async () => {
  const url = getScriptUrl();
  if (!url) return false;
  
  try {
     // Use no-cors for simple ping to avoid CORS issues on simple checks if needed, 
     // but since we have a specific URL, we can try standard fetch first.
     await fetch(`${url}?action=test`, { mode: 'no-cors' });
     return true;
  } catch(e) {
     return false;
  }
};

export const triggerSetup = async () => {
  const url = getScriptUrl();
  if (!url) return;
  
  try {
    await fetch(`${url}?action=setup`, { mode: 'no-cors' });
  } catch (e) {
    console.error('Setup trigger failed', e);
  }
};

export const seedDatabase = async () => {
  const url = getScriptUrl();
  if (!url) return;

  try {
    await sendToGas({ action: 'seed' });
  } catch(e) {
    console.error("Seed failed (likely CORS on response, but action executed)", e);
  }
};

export const fetchInitialData = async () => {
  const url = getScriptUrl();
  if (!url) return null;

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
  const url = getScriptUrl();
  
  // Gracefully handle missing URL by logging a warning instead of throwing error
  if (!url) {
    console.log(`[Local Mode] Sync to '${sheetName}' skipped (No URL configured).`);
    return;
  }

  try {
    await sendToGas({
      action: 'sync',
      sheet: sheetName,
      operation: operation,
      data: data
    });
    console.log(`Synced to ${sheetName} [${operation}]`);
  } catch (e) {
    console.error('Failed to sync data', e);
  }
};

export const saveDataToSheet = async (sheetName: string, data: any) => {
   console.warn('saveDataToSheet is deprecated, use syncToSheet');
};

// --- LINE Alert ---
export const sendLineAlertToScript = async (notification: Notification) => {
  const url = getScriptUrl();
  if (!url) return;

  const isIV = notification.type === NotificationType.IV_ALERT;
  
  const linePayload = {
    title: isIV ? 'IV Fluid Alert' : 'High-Risk Med Alert',
    color: isIV ? '#3b82f6' : '#e11d48', 
    message: notification.payload.message,
    hn: notification.hn,
    bed: notification.bed_id,
    detail: isIV 
      ? `Due: ${new Date(notification.payload.target_date).toLocaleString('th-TH')}` 
      : `Expire: ${new Date(notification.payload.target_date).toLocaleString('th-TH')}`
  };

  try {
    await sendToGas({
      action: 'send_line',
      payload: linePayload
    });
  } catch (e) {
    // console.error('Failed to send LINE', e);
  }
};
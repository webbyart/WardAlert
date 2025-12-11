import { Notification, NotificationType } from '../types';

// The specific Web App URL provided for this project
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwkhn-4_SKTHvVFV-JDYgcQVFvgh7-bwErxZSu_MHPiQ2bh8s80WXPHGiyPOxY6GR8/exec';

export const saveScriptUrl = (url: string) => {
  localStorage.setItem('wardAlert_scriptUrl', url);
};

export const getScriptUrl = () => {
  const stored = localStorage.getItem('wardAlert_scriptUrl');
  // Always fallback to the hardcoded URL if local storage is empty
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
    if (isRead) throw error; // Rethrow for reads so UI knows it failed
  }
};

export const testConnection = async () => {
  const url = getScriptUrl();
  if (!url) return false;
  
  try {
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
    console.error("Seed failed", e);
  }
};

export const fetchInitialData = async () => {
  const url = getScriptUrl();
  if (!url) return null;

  try {
    console.log('Fetching data from:', url);
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
  
  if (!url) {
    console.warn(`[Local Mode] Sync to '${sheetName}' skipped (No URL configured).`);
    return;
  }

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
    console.error('Failed to send LINE', e);
  }
};
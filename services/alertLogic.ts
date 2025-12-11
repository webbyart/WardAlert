import { IVFluid, HighRiskMed, Notification, NotificationType, NotificationStatus } from '../types';

/**
 * Checks if an IV Fluid record needs an alert.
 * Rule: Notify if (due_at - now) <= 4 days.
 */
export const shouldTriggerIVAlert = (iv: IVFluid, now: Date): boolean => {
  if (!iv.is_active) return false;
  
  const dueDate = new Date(iv.due_at);
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  // Alert if 4 days or less remain
  return diffDays <= 4;
};

/**
 * Checks if a High Risk Med record needs an alert.
 * Rule: Notify if (expire_at - now) <= 1 day.
 */
export const shouldTriggerMedAlert = (med: HighRiskMed, now: Date): boolean => {
  if (!med.is_active) return false;

  const expireDate = new Date(med.expire_at);
  const diffTime = expireDate.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // Alert if 1 day or less remains
  return diffDays <= 1;
};

/**
 * Generates the Thai message for IV alerts
 */
export const generateIVMessage = (hn: string, bedNumber: number, fluidType: string, dueDate: Date): string => {
  const dateStr = dueDate.toLocaleDateString('th-TH');
  const timeStr = dueDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `เตือน: HN ${hn} ที่เตียง ${bedNumber} — สารน้ำ (${fluidType}) จะครบกำหนดในวันที่ ${dateStr} เวลา ${timeStr} กรุณาดำเนินการเก็บหรือเปลี่ยนสารน้ำ`;
};

/**
 * Generates the Thai message for Medication alerts
 */
export const generateMedMessage = (hn: string, bedNumber: number, medName: string, expireDate: Date): string => {
  const dateStr = expireDate.toLocaleDateString('th-TH');
  const timeStr = expireDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `เตือนยาที่มีความเสี่ยงสูง: HN ${hn} ที่เตียง ${bedNumber} — ยา ${medName} จะหมดฤทธิ์ในวันที่ ${dateStr} เวลา ${timeStr} กรุณาตรวจสอบ`;
};

/**
 * Core Logic to scan records and return new notifications
 * This simulates what the Backend Scheduler would do.
 */
export const runAlertScanner = (
  ivs: IVFluid[],
  meds: HighRiskMed[],
  existingNotifications: Notification[],
  bedsMap: Record<number, number> // bedId -> bedNumber
): Notification[] => {
  const now = new Date(); // In a real test, this might be injected
  const newNotifications: Notification[] = [];
  const nextId = existingNotifications.length > 0 ? Math.max(...existingNotifications.map(n => n.id)) + 1 : 1;

  // Scan IVs
  ivs.forEach(iv => {
    if (shouldTriggerIVAlert(iv, now)) {
      // Check if alert already exists for this due date to avoid spamming
      const alreadyAlerted = existingNotifications.some(
        n => n.type === NotificationType.IV_ALERT && n.hn === iv.hn && n.payload.target_date === iv.due_at
      );

      if (!alreadyAlerted) {
        newNotifications.push({
          id: nextId + newNotifications.length,
          type: NotificationType.IV_ALERT,
          hn: iv.hn,
          bed_id: iv.bed_id,
          scheduled_at: now.toISOString(),
          status: NotificationStatus.PENDING,
          created_at: now.toISOString(),
          payload: {
            message: generateIVMessage(iv.hn, bedsMap[iv.bed_id] || iv.bed_id, iv.fluid_type, new Date(iv.due_at)),
            target_date: iv.due_at
          }
        });
      }
    }
  });

  // Scan Meds
  meds.forEach(med => {
    if (shouldTriggerMedAlert(med, now)) {
      const alreadyAlerted = existingNotifications.some(
        n => n.type === NotificationType.MED_ALERT && n.hn === med.hn && n.payload.target_date === med.expire_at
      );

      if (!alreadyAlerted) {
        newNotifications.push({
          id: nextId + newNotifications.length,
          type: NotificationType.MED_ALERT,
          hn: med.hn,
          bed_id: med.bed_id,
          scheduled_at: now.toISOString(),
          status: NotificationStatus.PENDING,
          created_at: now.toISOString(),
          payload: {
            message: generateMedMessage(med.hn, bedsMap[med.bed_id] || med.bed_id, med.med_name, new Date(med.expire_at)),
            target_date: med.expire_at
          }
        });
      }
    }
  });

  return newNotifications;
};
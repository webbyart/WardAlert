
import { IVFluid, HighRiskMed, Notification, NotificationType, NotificationStatus } from '../types';

/**
 * Checks if an IV Fluid record needs an alert.
 * Rule: Notify if (due_at - now) <= 4 hours (Refined for real usage).
 */
export const shouldTriggerIVAlert = (iv: IVFluid, now: Date): boolean => {
  if (!iv.is_active) return false;
  
  const dueDate = new Date(iv.due_at);
  const diffTime = dueDate.getTime() - now.getTime();
  const diffHours = diffTime / (1000 * 60 * 60);
  
  // Alert if 4 hours or less remain
  return diffHours <= 4;
};

/**
 * Checks if a High Risk Med record needs an alert.
 * Rule: Notify if (expire_at - now) <= 1 hour.
 */
export const shouldTriggerMedAlert = (med: HighRiskMed, now: Date): boolean => {
  if (!med.is_active) return false;

  const expireDate = new Date(med.expire_at);
  const diffTime = expireDate.getTime() - now.getTime();
  const diffHours = diffTime / (1000 * 60 * 60);

  // Alert if 1 hour or less remains
  return diffHours <= 1;
};

/**
 * Generates the Thai message for IV alerts
 */
export const generateIVMessage = (hn: string, bedNumber: number, fluidType: string, startDate: Date, dueDate: Date): string => {
  const dStart = startDate.toLocaleDateString('th-TH');
  const tStart = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const dDue = dueDate.toLocaleDateString('th-TH');
  const tDue = dueDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  
  return `HN ${hn} (เตียง ${bedNumber}): สารน้ำ ${fluidType}\nเริ่ม: ${dStart} ${tStart}\nครบกำหนด: ${dDue} ${tDue}\nกรุณาตรวจสอบ`;
};

/**
 * Generates the Thai message for Medication alerts
 */
export const generateMedMessage = (hn: string, bedNumber: number, medName: string, startDate: Date, expireDate: Date): string => {
  const dStart = startDate.toLocaleDateString('th-TH');
  const tStart = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const dExp = expireDate.toLocaleDateString('th-TH');
  const tExp = expireDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return `HN ${hn} (เตียง ${bedNumber}): ยา ${medName}\nเริ่ม: ${dStart} ${tStart}\nหมดฤทธิ์: ${dExp} ${tExp}\nกรุณาตรวจสอบ`;
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
            message: generateIVMessage(iv.hn, bedsMap[iv.bed_id] || iv.bed_id, iv.fluid_type, new Date(iv.started_at), new Date(iv.due_at)),
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
            message: generateMedMessage(med.hn, bedsMap[med.bed_id] || med.bed_id, med.med_name, new Date(med.started_at), new Date(med.expire_at)),
            target_date: med.expire_at
          }
        });
      }
    }
  });

  return newNotifications;
};

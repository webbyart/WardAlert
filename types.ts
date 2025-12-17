
export enum BedStatus {
  VACANT = 'vacant',
  OCCUPIED = 'occupied',
}

export enum PatientStatus {
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
}

export enum NotificationType {
  IV_ALERT = 'iv_alert',
  MED_ALERT = 'med_alert',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export interface Bed {
  id: number;
  bed_number: number;
  status: BedStatus;
  current_hn: string | null;
}

export interface Patient {
  id: number;
  hn: string;
  status: PatientStatus;
  created_at: string;
}

export interface IVFluid {
  id: number;
  hn: string;
  bed_id: number;
  started_at: string; // ISO Date string
  due_at: string; // ISO Date string
  fluid_type: string;
  notes?: string;
  is_active: boolean;
}

export interface HighRiskMed {
  id: number;
  hn: string;
  bed_id: number;
  started_at: string; // ISO Date string
  expire_at: string; // ISO Date string
  med_code: string;
  med_name: string;
  notes?: string;
  is_active: boolean;
}

export interface Notification {
  id: number;
  type: NotificationType;
  hn: string;
  bed_id: number;
  scheduled_at: string;
  triggered_at?: string;
  payload: {
    message: string;
    target_date: string;
  };
  status: NotificationStatus;
  created_at: string;
}

export interface LogEntry {
  id: number;
  action_type: 'ADMIT' | 'DISCHARGE' | 'ADD_IV' | 'ADD_MED' | 'UPDATE_BED' | 'DELETE_BED' | 'ADD_BED';
  details: string;
  timestamp: string; // ISO String
  performer?: string;
}

// For UI Forms
export interface AdmissionForm {
  hn: string;
  bed_id: number;
}

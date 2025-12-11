import { Bed, BedStatus, IVFluid, HighRiskMed, Notification, Patient, PatientStatus } from '../types';

// Initial Seed Data: 8 Beds
const initialBeds: Bed[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  bed_number: i + 1,
  status: [1, 2, 4, 5, 8].includes(i + 1) ? BedStatus.OCCUPIED : BedStatus.VACANT,
  current_hn: [1, 2, 4, 5, 8].includes(i + 1) ? `HN-${1000 + i}` : null,
}));

const now = new Date();

// Helper to add days
const addDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
// Helper to add hours
const addHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

const initialIVs: IVFluid[] = [
  {
    id: 1, hn: 'HN-1000', bed_id: 1, is_active: true,
    fluid_type: '0.9% NaCl 1000ml',
    started_at: addDays(-2),
    due_at: addHours(4), // Due very soon (Alert)
  },
  {
    id: 2, hn: 'HN-1001', bed_id: 2, is_active: true,
    fluid_type: '5% D/N/2 1000ml',
    started_at: addDays(-1),
    due_at: addDays(2), // Due in 2 days (Alert)
  },
  {
    id: 3, hn: 'HN-1003', bed_id: 4, is_active: true,
    fluid_type: 'Ringer Lactate',
    started_at: addDays(0),
    due_at: addDays(5), // Due in 5 days (No Alert)
  },
  {
    id: 4, hn: 'HN-1004', bed_id: 5, is_active: true,
    fluid_type: 'D5W 500ml',
    started_at: addDays(-3),
    due_at: addDays(-1), // Overdue (Alert)
  },
  {
    id: 5, hn: 'HN-1007', bed_id: 8, is_active: true,
    fluid_type: 'Acetar 1000ml',
    started_at: addDays(0),
    due_at: addDays(3), // Due in 3 days (Alert)
  }
];

const initialMeds: HighRiskMed[] = [
  {
    id: 1, hn: 'HN-1000', bed_id: 1, is_active: true,
    med_name: 'Dopamine', med_code: 'DOPA',
    started_at: addDays(-1),
    expire_at: addHours(2), // Expiring soon (Alert)
  },
  {
    id: 2, hn: 'HN-1001', bed_id: 2, is_active: true,
    med_name: 'Adrenaline', med_code: 'ADR',
    started_at: addDays(0),
    expire_at: addHours(20), // Expire in 20 hours (Alert)
  },
  {
    id: 3, hn: 'HN-1003', bed_id: 4, is_active: true,
    med_name: 'Fentanyl', med_code: 'FEN',
    started_at: addDays(-2),
    expire_at: addDays(2), // Expire in 2 days (No Alert)
  },
  {
    id: 4, hn: 'HN-1004', bed_id: 5, is_active: true,
    med_name: 'Insulin RI', med_code: 'INS',
    started_at: addDays(-5),
    expire_at: addHours(-2), // Expired (Alert)
  },
  {
    id: 5, hn: 'HN-1007', bed_id: 8, is_active: true,
    med_name: 'Amiodarone', med_code: 'AMIO',
    started_at: addDays(-1),
    expire_at: addHours(12), // Expire in 12 hours (Alert)
  }
];

export const mockDB = {
  beds: initialBeds,
  ivs: initialIVs,
  meds: initialMeds,
  notifications: [] as Notification[],
};

export const getBedNumberMap = () => {
  return mockDB.beds.reduce((acc, bed) => ({ ...acc, [bed.id]: bed.bed_number }), {});
};

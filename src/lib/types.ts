
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

export interface Company {
  id: string;
  name: string;
  address?: string; // Optional address
  contact?: string; // Optional contact
}

// Represents a specific scheduled instance of a plan for a patient
export interface ScheduledInstance {
    // Firestore Timestamps are automatically converted to Date objects on fetch
    date: Date;
    time?: string; // Optional specific time (HH:MM) for this instance
    // Add instance-specific status if needed, e.g., isCompleted
}


// Represents the details of a plan assigned to a patient
// This structure is intended for the SUBCOLLECTION under each patient
export interface AssignedPlan {
    planId: string;
    customDuration?: number; // Optional override for default duration
    scheduledInstances?: ScheduledInstance[]; // Array of specific date/time instances
    totalInstancesRequired?: number; // Optional: Total number of sessions/instances required for this plan
}

export interface Patient {
  id: string;
  name: string;
  companyId: string; // Link to Company
  address: string;
  contact: string;
  // This field IS NOW included directly when fetching/managing the patient state
  // It represents the data retrieved from the `assignedPlans` subcollection.
  assignedPlans: AssignedPlan[];
}

export interface Service {
  id: string;
  patientId: string; // Link to Patient
  companyId: string; // Denormalized from Patient for easier querying/reporting
  date: Date; // Converted from Firestore Timestamp on fetch
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  description: string; // This could reference a Plan's description or be custom
  durationMinutes: number; // Calculated duration
  userId: string; // ID of the user (nurse) who performed the service
}

// Represents an item to be displayed on the home page or calendar
export interface Appointment {
  id: string; // Can be service ID or a generated appointment ID (e.g., `plan-${patientId}-${planId}-${date.toISOString()}`)
  patientName: string;
  time: string; // Start time of the service/appointment (can be HH:MM or 'N/D')
  companyName: string; // Keep for display on home page card
  patientId: string;
  patientContact?: string; // Optional: Patient's contact number
  description?: string; // Add description from service or plan
  isCompleted: boolean; // Flag to track completion status
  isPlanBased: boolean; // Flag to indicate if it's from a plan or a logged service
  date: Date; // The specific date of the appointment instance
  planName?: string; // Optional: The name of the plan if isPlanBased is true
  durationMinutes?: number; // Optional: Duration if it's a completed service
}

// New type for Service Plans/Types
export interface Plan {
    id: string;
    name: string;       // e.g., "Medicazione Semplice", "Controllo Pressione"
    description?: string; // Optional detailed description
    defaultDuration: number; // Default time in minutes (e.g., 30, 45)
}

// Type for the counter document used for sequential IDs
export interface Counter {
    count: number;
}

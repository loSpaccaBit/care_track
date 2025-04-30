
// src/lib/firebase/firestore-utils.ts
import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  QueryConstraint,
  setDoc,
  DocumentReference,
  CollectionReference,
  DocumentData,
  collectionGroup,
  runTransaction,
} from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { db } from './firebase';
import type { Patient, Service, Company, Plan, AssignedPlan, ScheduledInstance } from '@/lib/types';

// --- Generic Functions ---

/**
 * Recursively converts Firestore Timestamps to JavaScript Date objects within an object or array.
 * Handles nested structures and potential circular references.
 * @param data - The data to process (object, array, Timestamp, or primitive).
 * @param visited - A Set to keep track of visited objects/arrays (for circular reference detection).
 * @returns Data with Timestamps converted to Dates.
 */
const convertTimestampsToDates = (data: any, visited = new Set()): any => {
    if (data === null || typeof data !== 'object' || data instanceof Date) {
        return data;
    }

    if (visited.has(data)) {
        console.warn("Circular reference detected during Timestamp conversion. Returning original object part.");
        return data;
    }
    visited.add(data);

    if (data instanceof Timestamp) {
        const date = data.toDate();
        visited.delete(data);
        return date;
    }

    if (Array.isArray(data)) {
        const newArr = data.map(item => convertTimestampsToDates(item, new Set(visited)));
        visited.delete(data);
        return newArr;
    }

    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            newObj[key] = convertTimestampsToDates(data[key], new Set(visited));
        }
    }

    visited.delete(data);
    return newObj;
};


/**
 * Recursively converts JavaScript Date objects to Firestore Timestamps within an object or array.
 * Handles nested structures and potential circular references.
 * @param data - The data to process (object, array, Date, or primitive).
 * @param visited - A Set to keep track of visited objects/arrays (for circular reference detection).
 * @returns Data with Dates converted to Timestamps.
 */
const convertDatesToTimestamps = (data: any, visited = new Set()): any => {
    if (data === null || typeof data !== 'object' || data instanceof Timestamp) {
        return data;
    }

    if (visited.has(data)) {
         console.warn("Circular reference detected during Date conversion. Returning original object part.");
        return data;
    }
     visited.add(data);

    if (data instanceof Date) {
        const timestamp = Timestamp.fromDate(data);
        visited.delete(data);
        return timestamp;
    }

    if (Array.isArray(data)) {
        const newArr = data.map(item => convertDatesToTimestamps(item, new Set(visited)));
        visited.delete(data);
        return newArr;
    }

    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
             // Skip keys that are typically subcollection references
             if (key === 'assignedPlans' && !Array.isArray(data[key])) {
                  // console.log(`Skipping timestamp conversion for key '${key}' as it might represent a subcollection path.`);
                  newObj[key] = data[key];
             } else {
                newObj[key] = convertDatesToTimestamps(data[key], new Set(visited));
             }
        }
    }

    visited.delete(data);
    return newObj;
};


/**
 * Fetches a single document by its ID from a specified collection.
 * @param collectionPath - The path to the Firestore collection.
 * @param id - The ID of the document to fetch.
 * @returns The document data (with Timestamps converted to Dates) or null if not found.
 */
export const getDataById = async <T>(collectionPath: string, id: string): Promise<T | null> => {
  if (!id) {
    console.error(`[getDataById] Invalid ID provided for collection ${collectionPath}:`, id);
    return null;
  }
  try {
    const docRef = doc(db, collectionPath, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return convertTimestampsToDates({ id: docSnap.id, ...data }) as T;
    } else {
      console.log(`[getDataById] No document found with ID ${id} in ${collectionPath}`);
      return null;
    }
  } catch (error) {
    console.error(`[getDataById] Error fetching document ${id} from ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Fetches all documents from a specified collection, applying optional constraints.
 * @param collectionPath - The path to the Firestore collection.
 * @param constraints - Optional Firestore query constraints (orderBy, limit).
 * @returns An array of document data (with Timestamps converted to Dates).
 */
export const getAllData = async <T>(collectionPath: string, constraints: QueryConstraint[] = []): Promise<T[]> => {
  try {
    const collRef = collection(db, collectionPath);
    const q = query(collRef, ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as T);
  } catch (error) {
    console.error(`[getAllData] Error fetching collection ${collectionPath}:`, error);
     if (error instanceof Error && error.message.includes("query requires an index")) {
        console.error("Firestore Index Required:", error.message);
    }
    throw error;
  }
};

/**
 * Queries documents from a specified collection based on constraints.
 * @param collectionPath - The path to the Firestore collection.
 * @param constraints - Firestore query constraints (where, orderBy, limit).
 * @returns An array of document data matching the query (with Timestamps converted to Dates).
 */
export const queryData = async <T>(collectionPath: string, constraints: QueryConstraint[]): Promise<T[]> => {
  if (!constraints || constraints.length === 0) {
      console.warn(`[queryData] Called for ${collectionPath} without constraints. Use getAllData instead?`);
      return getAllData<T>(collectionPath);
  }
  try {
    const collRef = collection(db, collectionPath);
    const q = query(collRef, ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as T);
  } catch (error) {
    console.error(`[queryData] Error querying collection ${collectionPath} with constraints:`, constraints, error);
     if (error instanceof Error && error.message.includes("query requires an index")) {
        console.error("Firestore Index Required:", error.message);
    }
    throw error;
  }
};

/**
 * Adds a new document to a specified collection using Firestore's auto-generated ID.
 * Converts Date objects to Timestamps before saving.
 * @param collectionPath - The path to the Firestore collection.
 * @param data - The data object to add (Dates will be converted).
 * @returns The newly created document data with its ID (Timestamps converted back to Dates).
 */
export const addData = async <T extends { id?: string }>(collectionPath: string, data: Omit<T, 'id'>): Promise<T> => {
  try {
    const dataWithTimestamps = convertDatesToTimestamps(data);
    const collRef = collection(db, collectionPath);
    const docRef = await addDoc(collRef, dataWithTimestamps);
    const newDocSnap = await getDoc(docRef);
    if (!newDocSnap.exists()) {
      throw new Error('Failed to fetch newly added document');
    }
    return convertTimestampsToDates({ id: newDocSnap.id, ...newDocSnap.data() }) as T;
  } catch (error) {
    console.error(`[addData] Error adding document to ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Sets (creates or overwrites) a document with a specific ID in a collection.
 * Converts Date objects to Timestamps before saving.
 * @param collectionPath - The path to the Firestore collection.
 * @param id - The ID of the document to set.
 * @param data - The data object to set (Dates will be converted).
 */
export const setData = async <T>(collectionPath: string, id: string, data: T): Promise<void> => {
  if (!id) {
    console.error(`[setData] Invalid ID provided for collection ${collectionPath}:`, id);
    throw new Error("Invalid ID provided for setData");
  }
  try {
    const dataWithTimestamps = convertDatesToTimestamps(data);
    const docRef = doc(db, collectionPath, id);
    await setDoc(docRef, dataWithTimestamps);
  } catch (error) {
    console.error(`[setData] Error setting document ${id} in ${collectionPath}:`, error);
    throw error;
  }
};


/**
 * Updates an existing document in a specified collection.
 * Converts Date objects to Timestamps before saving.
 * @param collectionPath - The path to the Firestore collection.
 * @param id - The ID of the document to update.
 * @param data - The partial data object with fields to update (Dates will be converted).
 */
export const updateData = async <T>(collectionPath: string, id: string, data: Partial<T>): Promise<void> => {
   if (!id) {
    console.error(`[updateData] Invalid ID provided for collection ${collectionPath}:`, id);
    throw new Error("Invalid ID provided for updateData");
  }
  try {
    // Explicitly handle potential undefined values before converting
    const cleanData: Partial<any> = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key) && data[key as keyof T] !== undefined) {
            cleanData[key] = data[key as keyof T];
        }
    }

    const dataWithTimestamps = convertDatesToTimestamps(cleanData);
    const docRef = doc(db, collectionPath, id);
    await updateDoc(docRef, dataWithTimestamps);
  } catch (error) {
    console.error(`[updateData] Error updating document ${id} in ${collectionPath}:`, error);
    throw error;
  }
};

/**
 * Deletes a document from a specified collection.
 * @param collectionPath - The path to the Firestore collection.
 * @param id - The ID of the document to delete.
 */
export const deleteData = async (collectionPath: string, id: string): Promise<void> => {
   if (!id) {
    console.error(`[deleteData] Invalid ID provided for collection ${collectionPath}:`, id);
    throw new Error("Invalid ID provided for deleteData");
  }
  try {
    const docRef = doc(db, collectionPath, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`[deleteData] Error deleting document ${id} from ${collectionPath}:`, error);
    throw error;
  }
};


// --- Specific Fetch Functions ---

// Patients
export const getPatient = (id: string): Promise<Patient | null> => getDataById<Patient>('patients', id);
export const getAllPatients = (): Promise<Patient[]> => getAllData<Patient>('patients', [orderBy('name')]);

// Companies
export const getCompany = (id: string): Promise<Company | null> => getDataById<Company>('companies', id);
export const getAllCompanies = (): Promise<Company[]> => getAllData<Company>('companies', [orderBy('name')]);

// Plans
export const getPlan = (id: string): Promise<Plan | null> => getDataById<Plan>('plans', id);
export const getAllPlans = (): Promise<Plan[]> => getAllData<Plan>('plans', [orderBy('name')]);

// Services
export const getService = (id: string): Promise<Service | null> => getDataById<Service>('services', id);
// Get all services, ordered newest first
// Requires Index: date DESC, startTime DESC
export const getAllServices = (): Promise<Service[]> => getAllData<Service>('services', [orderBy('date', 'desc'), orderBy('startTime', 'desc')]);

// Get services for a specific patient, ordered newest first
// Requires Index: patientId ASC, date DESC
export const getServicesByPatient = (patientId: string): Promise<Service[]> =>
    queryData<Service>('services', [
        where('patientId', '==', patientId),
        orderBy('date', 'desc'),
        // Sorting by startTime within the same day might require another index or client-side sorting
        // orderBy('startTime', 'desc')
    ]);


// Get services for a specific company within a date range, ordered chronologically
// Requires Index: companyId ASC, date ASC, startTime ASC
export const getServicesByCompanyForPeriod = (companyId: string, startDate: Date, endDate: Date): Promise<Service[]> => {
     const startTimestamp = Timestamp.fromDate(startOfDay(startDate));
     const endTimestamp = Timestamp.fromDate(endOfDay(endDate));
    return queryData<Service>('services', [
        where('companyId', '==', companyId),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp),
        orderBy('date', 'asc'),
        orderBy('startTime', 'asc'),
    ]);
}

// Get all services within a date range, ordered chronologically
// Requires Index: date ASC, startTime ASC
export const getAllServicesForPeriod = (startDate: Date, endDate: Date): Promise<Service[]> => {
    const startTimestamp = Timestamp.fromDate(startOfDay(startDate));
    const endTimestamp = Timestamp.fromDate(endOfDay(endDate));
    return queryData<Service>('services', [
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp),
        orderBy('date', 'asc'),
        orderBy('startTime', 'asc'),
    ]);
}


// Assigned Plans (Subcollection of Patients)
/**
 * Fetches assigned plans (and their scheduled instances) for a specific patient.
 * @param patientId - The ID of the patient.
 * @returns An array of AssignedPlan objects with Timestamps converted to Dates.
 */
export const getAssignedPlansForPatient = async (patientId: string): Promise<AssignedPlan[]> => {
    if (!patientId) {
      console.error("[getAssignedPlansForPatient] Invalid patientId provided.");
      return [];
    }
    const assignedPlansPath = `patients/${patientId}/assignedPlans`;
    // Fetching all plans without ordering might be simpler if client-side sorting is sufficient
    return getAllData<AssignedPlan>(assignedPlansPath);
};

/**
 * Updates the entire assigned plans subcollection for a patient.
 * Deletes existing plans and adds the new ones. Converts Dates to Timestamps.
 * @param patientId - The ID of the patient.
 * @param newAssignedPlans - The new array of AssignedPlan objects (Dates will be converted).
 */
export const updatePatientAssignedPlans = async (patientId: string, newAssignedPlans: AssignedPlan[]): Promise<void> => {
   if (!patientId) {
    console.error(`[updatePatientAssignedPlans] Invalid patientId provided.`);
    throw new Error("Invalid patientId provided for updatePatientAssignedPlans");
  }
  try {
    const assignedPlansRef = collection(db, `patients/${patientId}/assignedPlans`);
    const existingPlansSnapshot = await getDocs(query(assignedPlansRef));
    const existingPlanIds = new Set(existingPlansSnapshot.docs.map(doc => doc.id));

    const newPlanIds = new Set(newAssignedPlans.map(plan => plan.planId));
    const plansToDelete = [...existingPlanIds].filter(id => !newPlanIds.has(id));

    const deletePromises = plansToDelete.map(planId => deleteDoc(doc(assignedPlansRef, planId)));

    const setPromises = newAssignedPlans.map(plan => {
       // Ensure scheduledInstances is an array, default to empty array if null/undefined
       const planWithEnsuredInstances = {
           ...plan,
           scheduledInstances: plan.scheduledInstances || []
       };
       const planDataWithTimestamps = convertDatesToTimestamps(planWithEnsuredInstances);
       const planDocRef = doc(assignedPlansRef, plan.planId);
       return setDoc(planDocRef, planDataWithTimestamps);
    });

    await Promise.all([...deletePromises, ...setPromises]);

    console.log(`[updatePatientAssignedPlans] Successfully updated plans for patient ${patientId}`);
  } catch (error) {
    console.error(`[updatePatientAssignedPlans] Error updating plans for patient ${patientId}:`, error);
    throw error;
  }
};

// --- Helper function to get next sequential ID ---
/**
 * Gets the next sequential ID for a given collection prefix using a counter document.
 * Uses a Firestore transaction to ensure atomicity.
 * @param counterCollectionPath - Path to the collection holding counter documents (e.g., 'counters').
 * @param counterDocId - ID of the document holding the counter (e.g., 'patientCounter').
 * @param prefix - The prefix for the ID (e.g., 'p').
 * @returns The next sequential ID string (e.g., 'p1', 'p2').
 */
const getNextSequentialId = async (counterCollectionPath: string, counterDocId: string, prefix: string): Promise<string> => {
    const counterDocRef = doc(db, counterCollectionPath, counterDocId);
    let nextId: string = ''; // Initialize nextId

    try {
        await runTransaction(db, async (transaction) => {
            const counterDocSnap = await transaction.get(counterDocRef);
            let currentCount = 0;
            if (counterDocSnap.exists()) {
                currentCount = counterDocSnap.data()?.count || 0;
            }
            const nextCount = currentCount + 1;
            nextId = `${prefix}${nextCount}`;

            transaction.set(counterDocRef, { count: nextCount }, { merge: !counterDocSnap.exists() });
        });
        return nextId;
    } catch (error) {
        console.error(`Error getting next sequential ID for ${prefix}:`, error);
        throw new Error(`Failed to generate next ID for ${prefix}.`);
    }
};


// --- Specific Add/Delete Functions ---

/**
 * Adds a new patient document with a sequential ID (e.g., p1, p2).
 * Initializes the assignedPlans subcollection (it remains empty).
 * @param patientData - Data for the new patient (excluding id, assignedPlans field is ignored).
 * @returns The newly created Patient object with ID.
 */
export const addPatient = async (patientData: Omit<Patient, 'id' | 'assignedPlans'>): Promise<Patient> => {
    try {
        const newPatientId = await getNextSequentialId('counters', 'patientCounter', 'p');
        const patientBaseData = { ...patientData, id: newPatientId };
        const dataWithTimestamps = convertDatesToTimestamps(patientBaseData);

        await setData<Omit<Patient, 'assignedPlans'>>('patients', newPatientId, dataWithTimestamps);

        // Return the patient data including the ID. Represent assignedPlans as empty locally.
        return { ...convertTimestampsToDates(patientBaseData), assignedPlans: [] };

    } catch (error) {
        console.error("[addPatient] Error adding patient with sequential ID:", error);
        throw error;
    }
};

/**
 * Adds a new company document. Uses Firestore's auto-generated ID.
 * @param companyData - Data for the new company (excluding id).
 * @returns The newly created Company object with ID.
 */
export const addCompany = (companyData: Omit<Company, 'id'>): Promise<Company> => addData<Company>('companies', companyData);

/**
 * Adds a new plan document. Uses Firestore's auto-generated ID.
 * @param planData - Data for the new plan (excluding id).
 * @returns The newly created Plan object with ID.
 */
export const addPlan = (planData: Omit<Plan, 'id'>): Promise<Plan> => addData<Plan>('plans', planData);

/**
 * Adds a new service record. Uses Firestore's auto-generated ID.
 * Fetches patient's companyId. Converts Dates to Timestamps before saving.
 * Accepts an optional duration to avoid recalculation.
 * @param serviceData - Data for the new service (excluding id, durationMinutes, companyId).
 * @param durationMinutes - Optional: Pre-calculated duration in minutes. If not provided, it will be calculated.
 * @returns The newly created Service object with ID and calculated/provided duration.
 */
export const addService = async (
    serviceData: Omit<Service, 'id' | 'durationMinutes' | 'companyId'>,
    durationMinutes?: number // Make duration optional
): Promise<Service> => {
    const { patientId, date, startTime, endTime, description, userId } = serviceData;

    if (!patientId || !date || !startTime || !endTime || !description) {
        throw new Error("Missing required fields for adding a service.");
    }

     const patient = await getPatient(patientId);
     if (!patient) {
         throw new Error(`Patient with ID ${patientId} not found.`);
     }
     const companyId = patient.companyId;
     if (!companyId) {
        console.warn(`Patient ${patientId} does not have a companyId assigned.`);
        throw new Error(`Cannot add service: Patient ${patientId} is missing a companyId.`);
     }

     // Use provided duration or calculate if not provided
     const finalDurationMinutes = durationMinutes !== undefined && durationMinutes >= 0
        ? durationMinutes
        : calculateDuration(startTime, endTime);

     if (finalDurationMinutes < 0) {
        // This happens if calculated duration is negative (end before start)
        throw new Error("End time must be after start time.");
     }

    const serviceToAdd = {
        patientId,
        date,
        startTime,
        endTime,
        description,
        companyId,
        userId: userId || 'unknown',
        durationMinutes: finalDurationMinutes, // Use the final duration
    };

    // Add data and expect the full object with ID back
    const addedDocWithId = await addData<Service>('services', serviceToAdd);

    // Return the complete service object including the generated ID
    return addedDocWithId;
};


/**
 * Deletes a patient document from the 'patients' collection.
 * This also deletes the 'assignedPlans' subcollection for the patient.
 * Note: This does NOT automatically delete associated services from the top-level 'services' collection.
 * @param patientId - The ID of the patient to delete.
 */
export const deletePatient = async (patientId: string): Promise<void> => {
    if (!patientId) {
        console.error("[deletePatient] Invalid patientId provided.");
        throw new Error("Invalid patientId provided for deletePatient");
    }
    try {
        // Delete assignedPlans subcollection first
        const assignedPlansRef = collection(db, `patients/${patientId}/assignedPlans`);
        const plansSnapshot = await getDocs(query(assignedPlansRef));
        const deletePlanPromises = plansSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePlanPromises);
        console.log(`[deletePatient] Deleted assignedPlans subcollection for patient ${patientId}`);

        // Delete the main patient document
        await deleteData('patients', patientId);
        console.log(`[deletePatient] Successfully deleted patient document ${patientId}. Associated services in the 'services' collection were NOT deleted.`);
    } catch (error) {
        console.error(`[deletePatient] Error deleting patient ${patientId}:`, error);
        throw error;
    }
};


// --- Helper function to calculate duration ---
const calculateDuration = (start: string | undefined, end: string | undefined): number => {
  if (!start || !end || start === 'N/D' || end === 'N/D') return 0;

  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(start) || !timeRegex.test(end)) {
      console.warn(`Invalid time format for duration calculation: start=${start}, end=${end}`);
      return 0;
  }

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM) ||
      startH > 23 || startM > 59 || endH > 23 || endM > 59) {
       console.warn(`Invalid time values for duration calculation: start=${start}, end=${end}`);
      return 0;
  }

  const startTimeMinutes = startH * 60 + startM;
  const endTimeMinutes = endH * 60 + endM;

  if (endTimeMinutes < startTimeMinutes) {
       console.warn(`End time (${end}) is before start time (${start}). Returning zero duration.`);
       // Changed behavior: return 0 if end is before start, as negative duration is usually an error.
       // Alternatively, throw an error: throw new Error("End time cannot be before start time");
       return 0;
  }

  return endTimeMinutes - startTimeMinutes;
};

    
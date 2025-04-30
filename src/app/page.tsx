
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Clock, User, Building, Info, CheckSquare, Square, Calendar as CalendarIcon, RotateCcw, ListChecks, Timer, Loader2, Trash2, Phone } from 'lucide-react'; // Added Phone icon
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import ClientDateDisplay from '@/components/client-date-display';
// Updated imports to use Firestore utils
import {
    getAllServicesForPeriod, // For today's initial load
    getPatient,
    getPlan,
    updatePatientAssignedPlans, // For rescheduling
    addService, // For completing a plan
    deleteData, // For deleting a service when unmarked
    getAssignedPlansForPatient,
    getCompany, // Needed for company name
    getAllPatients, // Needed for plan fetching loop
    getAllPlans, // Needed for plan details
    getAllCompanies, // Needed for company details
} from '@/lib/firebase/firestore-utils';
import type { Appointment, Service, Plan, Patient, AssignedPlan, ScheduledInstance, Company } from '@/lib/types';
import { format, startOfDay, endOfDay, isSameDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context'; // Use useAuth for user info
import { Timestamp, updateDoc, doc } from 'firebase/firestore'; // Import Timestamp, updateDoc, doc
import { db } from '@/lib/firebase/firebase'; // Import db
import { useRouter } from 'next/navigation'; // Import useRouter
import { usePushNotifications } from '@/hooks/usePushNotifications'; // Import the push hook
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import Alert Dialog


// Define date options outside the component
const dateOptions: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

// Skeleton component for appointment card
const AppointmentCardSkeleton: FC = () => (
    <Card className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <CardHeader className="p-4 bg-muted/30 border-b border-border">
            <Skeleton className="h-6 w-3/5 rounded" />
            <Skeleton className="h-4 w-2/5 mt-1 rounded" />
             <Skeleton className="h-4 w-3/5 mt-2 rounded" /> {/* Added skeleton for phone */}
        </CardHeader>
        <CardContent className="p-4 grid gap-2 text-sm">
             <Skeleton className="h-4 w-4/5 rounded" />
             <Skeleton className="h-4 w-full rounded" />
             <Skeleton className="h-3 w-1/4 mb-1 rounded" />
        </CardContent>
        <CardFooter className="p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
           <Skeleton className="h-8 w-8 rounded" />
           <Skeleton className="h-8 w-8 rounded" />
           <Skeleton className="h-8 w-8 rounded" /> {/* Added skeleton for delete */}
        </CardFooter>
    </Card>
);

// Helper function to group items by patient and time
const groupItemsByPatientAndTime = (items: Appointment[]): Record<string, Appointment[]> => {
    const grouped: Record<string, Appointment[]> = {};
    items.forEach(item => {
        const timeKey = item.time || 'N/D';
        const patientIdKey = item.patientId.trim();
        const groupKey = `${patientIdKey}-${timeKey}`;
        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }
        grouped[groupKey].push(item);
    });
    return grouped;
};

const HomePage: FC = () => {
  const { loading: authLoading, user } = useAuth(); // Use useAuth instead of useAuthRedirect
  const { toast } = useToast();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [itemCompletionStatus, setItemCompletionStatus] = useState<Record<string, boolean>>({});
  const [isCompleting, setIsCompleting] = useState<Record<string, boolean>>({}); // Loading state per item
  const [showReschedulePopover, setShowReschedulePopover] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isClientReady, setIsClientReady] = useState(false); // Track client readiness
  const { isPushEnabled, isPushSupported } = usePushNotifications(); // Get push status
  const [itemToDelete, setItemToDelete] = useState<{ id: string; description: string } | null>(null); // State for delete confirmation
  const [isDeleting, setIsDeleting] = useState(false); // State for deletion loading
  const [plansMap, setPlansMap] = useState<Record<string, Plan>>({}); // State for plansMap
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({}); // State for companiesMap
  const [patientsMap, setPatientsMap] = useState<Record<string, Patient>>({}); // State for patientsMap


  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Define stable toast function using useCallback
  const showToast = useCallback(toast, []);

  // --- Data Loading ---
  const loadAppointments = useCallback(async () => {
     if (!user || authLoading || !isClientReady) { // Added isClientReady check
        setIsLoading(authLoading || !isClientReady); // Adjust loading state based on auth and client readiness
        setAppointments([]); // Clear appointments if not logged in or not ready
        return;
     }
    setIsLoading(true);
    try {
        console.log("HomePage: Starting data fetch...");
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        // 1. Fetch logged services for today
        const servicesToday = await getAllServicesForPeriod(todayStart, todayEnd);
        console.log(`HomePage: Fetched ${servicesToday.length} services for today.`);

        // 2. Fetch all patients to check their assigned plans
        const fetchedPatients = await getAllPatients();
        console.log(`HomePage: Fetched ${fetchedPatients.length} patients.`);

        // 3. Fetch details needed for display (Plans, Companies)
        const allPlans = await getAllPlans();
        const allCompanies = await getAllCompanies();
        const fetchedPlansMap = Object.fromEntries(allPlans.map(p => [p.id, p]));
        const fetchedCompaniesMap = Object.fromEntries(allCompanies.map(c => [c.id, c]));
        const fetchedPatientsMap = Object.fromEntries(fetchedPatients.map(p => [p.id, p]));
        setPlansMap(fetchedPlansMap); // Set state
        setCompaniesMap(fetchedCompaniesMap); // Set state
        setPatientsMap(fetchedPatientsMap); // Set state
        console.log(`HomePage: Created maps for ${allPlans.length} plans and ${allCompanies.length} companies.`);

        const fetchedAppointments: Appointment[] = [];
        const addedPlanInstanceIds = new Set<string>(); // Track added plan instances
        const initialStatus: Record<string, boolean> = {};

        // Process logged services
        servicesToday.forEach(service => {
            const patient = fetchedPatientsMap[service.patientId];
            const company = patient ? fetchedCompaniesMap[patient.companyId] : undefined;
            fetchedAppointments.push({
                id: service.id,
                patientName: patient?.name || 'Paziente Sconosciuto',
                time: service.startTime || 'N/D',
                companyName: company?.name || 'Azienda Sconosciuta',
                patientId: service.patientId,
                patientContact: patient?.contact, // Add contact number
                description: service.description,
                isCompleted: true, // Services logged are implicitly completed today
                isPlanBased: false,
                date: service.date, // Already a Date object from Firestore utils
                planName: undefined,
                durationMinutes: service.durationMinutes, // Include duration
            });
            initialStatus[service.id] = true; // Mark as complete
        });
         console.log("HomePage: Processed logged services.");

        // Process scheduled plans for today
        for (const patient of fetchedPatients) {
             // Fetch assigned plans for *this* patient
             const assignedPlans = await getAssignedPlansForPatient(patient.id);

            for (const assignedPlan of assignedPlans) {
                 if (!assignedPlan.scheduledInstances) continue;

                for (const instance of assignedPlan.scheduledInstances) {
                    // instance.date should already be a Date object from Firestore utils
                     if (instance.date && isSameDay(instance.date, todayStart)) {
                         const plan = fetchedPlansMap[assignedPlan.planId];
                         const planName = plan?.name || 'Piano Sconosciuto';
                         const company = fetchedCompaniesMap[patient.companyId];
                         // Ensure date is correctly formatted for the ID
                         const dateISOForId = instance.date.toISOString().split('T')[0]; // Use YYYY-MM-DD for consistency
                         // Create a unique ID combining patient, plan, and date
                         const instanceId = `plan-${patient.id}-${assignedPlan.planId}-${dateISOForId}`; // Unique ID

                         // Check if a SERVICE matching this specific plan instance exists
                         const loggedAsServiceToday = servicesToday.some(s =>
                             s.patientId === patient.id &&
                             (s.description === `Piano: ${planName}` || (planName !== 'Piano Sconosciuto' && s.description?.includes(planName))) &&
                             isSameDay(s.date, instance.date) && // Match date explicitly
                             (s.startTime === instance.time || !instance.time || instance.time === 'N/D') // Match time if available
                         );

                        // Add the plan instance only if it hasn't been logged as a service yet
                        if (!loggedAsServiceToday && !addedPlanInstanceIds.has(instanceId)) {
                            fetchedAppointments.push({
                                id: instanceId,
                                patientName: patient.name,
                                time: instance.time || 'N/D',
                                companyName: company?.name || 'Azienda Sconosciuta',
                                patientId: patient.id,
                                patientContact: patient.contact, // Add contact number
                                description: `Piano: ${planName}`,
                                planName: planName,
                                isCompleted: false, // Initially not completed
                                isPlanBased: true,
                                date: instance.date, // The date of this instance
                                durationMinutes: assignedPlan.customDuration ?? plan?.defaultDuration, // Add duration for plans too
                            });
                            addedPlanInstanceIds.add(instanceId);
                            initialStatus[instanceId] = false; // Mark as incomplete initially
                         } else if (loggedAsServiceToday) {
                              // If it *was* logged as a service, ensure we don't add the duplicate plan ID
                              addedPlanInstanceIds.add(instanceId);
                         }
                    }
                }
            }
        }
         console.log("HomePage: Processed scheduled plans.");


        // Initialize completion status (services are complete, plans are not initially)
        // Moved inside the loop for accuracy
        setItemCompletionStatus(initialStatus);

        // Sort and set state
        fetchedAppointments.sort((a, b) => {
            const timeA = a.time || 'N/D';
            const timeB = b.time || 'N/D';
            if (timeA === 'N/D' && timeB === 'N/D') return a.patientName.localeCompare(b.patientName);
            if (timeA === 'N/D') return 1;
            if (timeB === 'N/D') return -1;
            return timeA.localeCompare(timeB);
        });

        setAppointments(fetchedAppointments);
         console.log(`HomePage: Data fetch complete. ${fetchedAppointments.length} total appointments for today.`);

    } catch (error) {
        console.error("HomePage: Error loading appointments:", error);
        showToast({ variant: "destructive", title: "Errore", description: "Impossibile caricare gli appuntamenti." });
        setAppointments([]); // Clear appointments on error
    } finally {
        console.log("HomePage: Setting loading to false.");
        setIsLoading(false);
    }
  }, [user, authLoading, isClientReady, showToast]); // Added useCallback dependencies

  useEffect(() => {
    // Only load if user is authenticated and client is ready
    if (!authLoading && user && isClientReady) {
        loadAppointments();
    } else if (!authLoading && !user && isClientReady) {
        // If auth is resolved but no user, clear data and stop loading
        setIsLoading(false);
        setAppointments([]);
        console.log("HomePage Effect: Auth resolved, no user. Cleared data.");
    } else {
        // Set loading based on auth status or client readiness
        setIsLoading(authLoading || !isClientReady);
        console.log(`HomePage Effect: Waiting. AuthLoading: ${authLoading}, ClientReady: ${isClientReady}`);
    }
     // Dependency on user ensures reload on login/logout
     // Dependency on authLoading ensures we wait for auth resolution
     // Dependency on isClientReady ensures we wait for client mount
  }, [user, authLoading, isClientReady, loadAppointments]); // Added loadAppointments


    // --- Notification Scheduling ---
    useEffect(() => {
        if (isClientReady && isPushEnabled && appointments.length > 0 && navigator.serviceWorker.controller) {
            console.log("[HomePage] Push enabled, sending appointments to SW for scheduling.");
            // Filter for relevant appointments (today, specific time, not completed)
            const appointmentsToSchedule = appointments.filter(app =>
                app.time && app.time !== 'N/D' && !itemCompletionStatus[app.id] && isSameDay(app.date, new Date()) // Use completion status state
            );
            navigator.serviceWorker.controller.postMessage({
                type: 'SCHEDULE_APPOINTMENTS',
                payload: appointmentsToSchedule
            });
        } else if (isClientReady && !isPushEnabled && navigator.serviceWorker.controller) {
            // If push becomes disabled, tell SW to clear any scheduled notifications
            console.log("[HomePage] Push disabled, sending clear message to SW.");
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_NOTIFICATIONS' });
        }
        // Rerun when push status, completion status, or appointments change
    }, [isClientReady, isPushEnabled, appointments, itemCompletionStatus]);


  // --- Event Handlers ---

   // Handle completion change for an INDIVIDUAL item within a group
   const handleCompletionChange = async (appointmentId: string, completed: boolean | 'indeterminate') => {
      if (completed === 'indeterminate' || isCompleting[appointmentId]) return; // Ignore indeterminate state or if already processing

      const appointment = appointments.find(app => app.id === appointmentId);
      if (!appointment || !user) {
           showToast({ variant: "destructive", title: "Errore", description: "Impossibile aggiornare lo stato. Riprovare." });
           return; // Ensure user exists
        }

       setIsCompleting(prev => ({ ...prev, [appointmentId]: true })); // Start loading for this specific item

       // Optimistically update local state first for better UX
       setItemCompletionStatus(prev => ({
          ...prev,
          [appointmentId]: completed === true,
       }));

      try {
          if (completed && appointment.isPlanBased) {
              // Mark a PLAN as complete -> Create a Service record
              console.log(`Completing Plan: ${appointmentId}`);

              // Fetch necessary plan details if not already sufficiently available
              const planIdMatch = appointment.id.match(/^plan-.+?-(.+?)-/);
              if (!planIdMatch || !planIdMatch[1]) throw new Error("Invalid plan item ID format");
              const planId = planIdMatch[1];
              const plan = plansMap[planId]; // Use plansMap from state
              if (!plan) throw new Error(`Dettagli del piano ${planId} non trovati`);

              const startTime = appointment.time !== 'N/D' ? appointment.time : format(new Date(), 'HH:mm');
              // Use duration from the appointment object (could be custom or default)
              const duration = appointment.durationMinutes ?? plan.defaultDuration;
              const endTimeDate = new Date(appointment.date); // Use the instance date!
              const [startH, startM] = startTime.split(':').map(Number);
              endTimeDate.setHours(startH, startM + duration, 0, 0);
              const endTime = format(endTimeDate, 'HH:mm');

              const servicePayload = {
                  patientId: appointment.patientId,
                  date: appointment.date,
                  startTime: startTime,
                  endTime: endTime,
                  description: `Piano: ${appointment.planName || plan.name}`,
                  userId: user.uid,
                  // companyId will be added by addService
                  // durationMinutes will be added/verified by addService
              };

              const addedService = await addService(servicePayload, duration);
              console.log(`Created Service: ${addedService.id} from Plan: ${appointmentId}`);

              // Update local state: replace plan item with service item
              setAppointments(prev => {
                    const newItems = prev.filter(i => i.id !== appointmentId); // Remove the plan item
                    const newServiceItem: Appointment = { // Create the service item
                         ...appointment, // Copy basic details
                         id: addedService.id, // Use the new service ID
                         isCompleted: true,
                         isPlanBased: false,
                         // itemType: 'service', // Ensure itemType is defined if using union types
                         time: addedService.startTime, // Use actual start/end times
                         durationMinutes: addedService.durationMinutes,
                         description: addedService.description, // Use service description
                    };
                    newItems.push(newServiceItem);
                    // Re-sort
                     newItems.sort((a, b) => {
                         const timeA = a.time || 'N/D'; const timeB = b.time || 'N/D';
                         if (timeA === 'N/D' && timeB === 'N/D') return a.patientName.localeCompare(b.patientName);
                         if (timeA === 'N/D') return 1; if (timeB === 'N/D') return -1;
                         return timeA.localeCompare(timeB);
                     });
                    return newItems;
                });
                // Update completion status map with the new service ID
                setItemCompletionStatus(prev => {
                    const newState = { ...prev };
                    delete newState[appointmentId]; // Remove old plan ID status
                    newState[addedService.id] = true; // Add new service ID status
                    return newState;
                });

                showToast({
                    title: "Completato",
                    description: `Piano ${appointment.planName || ''} registrato come prestazione.`,
                    duration: 3000,
                });

          } else if (!completed && !appointment.isPlanBased) {
             // Unchecking a SERVICE -> Delete the Service record
             console.log(`Uncompleting Service: ${appointmentId}. Deleting service record...`);

             await deleteData('services', appointmentId);

             // Convert the service back into its corresponding Plan appointment if possible
             // Attempt to parse plan details from description
             const planMatch = appointment.description?.match(/^Piano: (.+)$/);
             const planNameFromDesc = planMatch ? planMatch[1] : null;
             let correspondingPlanId: string | null = null;
             if (planNameFromDesc) {
                // Use plansMap from state instead of fetching again
                const matchedPlan = Object.values(plansMap).find(p => p.name === planNameFromDesc);
                correspondingPlanId = matchedPlan?.id || null;
             }

             setAppointments(prev => {
                  const newItems = prev.filter(i => i.id !== appointmentId); // Remove the service item
                  // If we found a corresponding plan, add the plan instance back
                   if (correspondingPlanId) {
                      const planDateISO = appointment.date.toISOString().split('T')[0];
                      const planInstanceId = `plan-${appointment.patientId}-${correspondingPlanId}-${planDateISO}`;
                      const plan = plansMap[correspondingPlanId]; // Use plansMap from state
                      const patient = patientsMap[appointment.patientId]; // Get patient from map
                      const company = companiesMap[patient?.companyId || '']; // Use maps from state

                       // Check if this plan instance already exists (maybe added manually before)
                       const exists = newItems.some(item => item.id === planInstanceId);
                       if (!exists) {
                           newItems.push({
                               id: planInstanceId,
                               patientName: appointment.patientName,
                               time: appointment.time,
                               companyName: company?.name || 'Azienda Sconosciuta',
                               patientId: appointment.patientId,
                               patientContact: patient?.contact, // Add contact back
                               description: `Piano: ${planNameFromDesc}`,
                               planName: planNameFromDesc || undefined,
                               isCompleted: false, // Now incomplete
                               isPlanBased: true,
                               date: appointment.date,
                               durationMinutes: plan?.defaultDuration, // Use default or need to fetch assigned plan duration
                           });
                       }
                  }
                 // Re-sort
                 newItems.sort((a, b) => {
                     const timeA = a.time || 'N/D'; const timeB = b.time || 'N/D';
                     if (timeA === 'N/D' && timeB === 'N/D') return a.patientName.localeCompare(b.patientName);
                     if (timeA === 'N/D') return 1; if (timeB === 'N/D') return -1;
                     return timeA.localeCompare(timeB);
                 });
                 return newItems;
             });
               // Update completion status map
               setItemCompletionStatus(prev => {
                    const newState = { ...prev };
                    delete newState[appointmentId]; // Remove old service ID status
                    // Add corresponding plan ID status if generated
                    if (correspondingPlanId) {
                        const planDateISO = appointment.date.toISOString().split('T')[0];
                        const planInstanceId = `plan-${appointment.patientId}-${correspondingPlanId}-${planDateISO}`;
                         newState[planInstanceId] = false;
                    }
                    return newState;
                });

              showToast({
                 title: "Da Completare",
                 description: `Prestazione "${appointment.description || ''}" riportata a da completare.`,
                 duration: 2000,
              });

          } else if (completed && !appointment.isPlanBased) {
             // Re-checking a SERVICE that was somehow marked incomplete visually (shouldn't happen with delete logic)
             // This case might occur if the delete logic above failed, or if state gets inconsistent.
             console.warn(`Re-checking service ${appointmentId}. This might indicate inconsistent state.`);
             // No backend change needed if the service document still exists.
              showToast({
                 title: "Completato",
                 description: `Prestazione ${appointment.description || ''} segnata come completata.`,
                 duration: 2000,
              });
              // Optimistic update already handled visual change.

          } else if (!completed && appointment.isPlanBased) {
             // Unchecking a PLAN (no backend change needed)
             console.log(`Uncompleting Plan visually: ${appointmentId}`);
              showToast({
                 title: "Da Completare",
                 description: `Piano ${appointment.planName || ''} segnato come da completare.`,
                 duration: 2000,
              });
             // Optimistic update handled visual change.
          }

      } catch (error) {
          console.error("Error updating completion status:", error);
          showToast({ variant: "destructive", title: "Errore", description: "Impossibile aggiornare lo stato." });
          // Revert optimistic update on error
           setItemCompletionStatus(prev => ({
              ...prev,
              [appointmentId]: !completed, // Revert the checkbox state
           }));
            // Consider reloading data fully on error to ensure consistency
           loadAppointments();
      } finally {
           setIsCompleting(prev => ({ ...prev, [appointmentId]: false })); // Stop loading for this specific item
      }
   };


   // Reschedule - Needs to update Firestore 'assignedPlans' subcollection or 'services' document
   const handleReschedule = async (appointmentId: string, isPlanBased: boolean, newDate: Date | undefined) => {
      if (!newDate) {
          showToast({ variant: "destructive", title: "Errore", description: "Seleziona una data valida per riprogrammare." });
          return;
      }
      const todayStart = startOfDay(new Date());
       if (startOfDay(newDate) < todayStart) { // Compare start of day
          showToast({ variant: "destructive", title: "Errore", description: "Non puoi riprogrammare nel passato." });
          return;
      }
      const originalAppointment = appointments.find(app => app.id === appointmentId);
       if (!originalAppointment) return;

      const originalDate = originalAppointment.date;
      if (isSameDay(newDate, originalDate)) {
            showToast({ variant: "destructive", title: "Errore", description: "Seleziona un giorno diverso da quello attuale per posticipare." });
            return; // Cannot reschedule TO the same day
      }

      setIsCompleting(prev => ({ ...prev, [appointmentId]: true })); // Use isCompleting to show loading

       // --- Optimistic UI Update ---
       // Remove the item from the local state immediately
       setAppointments(prev => prev.filter(app => app.id !== appointmentId));
       // Also remove from completion status
       setItemCompletionStatus(prev => {
           const newState = { ...prev };
           delete newState[appointmentId];
           return newState;
       });
       setShowReschedulePopover(null); // Close the popover
       setSelectedDate(undefined);
       // --- End Optimistic UI Update ---

       showToast({ title: "Riprogrammazione...", description: "Aggiornamento in corso..." });

      try {
          // --- Firestore Reschedule Logic ---
          if (isPlanBased) {
                // 1. Extract info from appointmentId: plan-patientId-planId-dateISO
                const parts = appointmentId.match(/^plan-(.+?)-(.+?)-(.+)$/);
                if (!parts || parts.length < 4) throw new Error("ID appuntamento piano non valido");
                const patientId = parts[1];
                const planId = parts[2];
                const oldDateISO = parts[3];
                const oldDate = startOfDay(parseISO(oldDateISO)); // Should be valid if ID was generated correctly

                // 2. Fetch current assigned plans for the patient
                const assignedPlans = await getAssignedPlansForPatient(patientId);
                // const plansMap = Object.fromEntries((await getAllPlans()).map(p => [p.id, p])); // Need plan details - use state instead

                // 3. Find the specific plan and instance
                let planFound = false;
                let instanceUpdated = false;
                const updatedPlans = assignedPlans.map(ap => {
                    if (ap.planId === planId && ap.scheduledInstances) {
                        planFound = true;
                        const instanceIndex = ap.scheduledInstances.findIndex(inst => inst.date && isSameDay(inst.date, oldDate));
                        if (instanceIndex !== -1) {
                             const originalInstance = ap.scheduledInstances[instanceIndex];
                             // Check if new date already exists
                             const newDateExists = ap.scheduledInstances.some((inst, idx) => idx !== instanceIndex && inst.date && isSameDay(inst.date, newDate));
                             if (!newDateExists) {
                                // Update date, ensure start of day
                                const updatedInstance = { ...originalInstance, date: startOfDay(newDate) };
                                ap.scheduledInstances[instanceIndex] = updatedInstance;
                                instanceUpdated = true;
                             } else {
                                // New date exists, remove the old instance instead (already handled optimistically)
                                ap.scheduledInstances.splice(instanceIndex, 1);
                                instanceUpdated = true; // Considered updated by removal
                                showToast({ variant: "default", title:"Nota", description: `Esisteva già un impegno per ${format(newDate, 'dd/MM/yy')}. Il vecchio impegno duplicato è stato rimosso.`})
                             }
                              // Keep sorted
                              ap.scheduledInstances.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
                        }
                    }
                    return ap;
                });

                if (!planFound || !instanceUpdated) {
                     console.warn(`Plan instance not found for rescheduling: ${appointmentId}`);
                     // No need to throw error if already handled optimistically, but log it
                     // throw new Error("Impossibile trovare o aggiornare l'istanza del piano.");
                } else {
                    // 4. Save the updated plans back to Firestore
                    await updatePatientAssignedPlans(patientId, updatedPlans);
                }

          } else {
                // Rescheduling a logged Service - Update the service document date
                 await updateDoc(doc(db, 'services', appointmentId), { date: Timestamp.fromDate(startOfDay(newDate)) });
          }

         showToast({ title: "Riprogrammato", description: `Impegno spostato al ${format(newDate, 'dd/MM/yyyy')}.` });
         // No need to call loadAppointments() here as the item was removed optimistically

      } catch (error: any) {
          console.error("Error rescheduling appointment:", error);
          showToast({ variant: "destructive", title: "Errore Riprogrammazione", description: error.message || "Impossibile riprogrammare l'impegno." });
          // Revert optimistic update by reloading data
          loadAppointments(); // Force reload on error to get consistent state
      } finally {
           setIsCompleting(prev => ({ ...prev, [appointmentId]: false })); // Stop loading state
      }
   };

    // Delete Handler for Logged Services
    const handleDeleteConfirm = async () => {
      if (!itemToDelete || !user) return;
      setIsDeleting(true);
      try {
        const { id, description } = itemToDelete;
        await deleteData('services', id);

        // Remove from local state
        setAppointments(prev => prev.filter(app => app.id !== id));
        setItemCompletionStatus(prev => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
        });

        showToast({ title: "Successo", description: `Prestazione "${description}" eliminata.` });
        setItemToDelete(null); // Close dialog
      } catch (error) {
        console.error(`Error deleting service:`, error);
        showToast({ variant: "destructive", title: "Errore", description: `Impossibile eliminare la prestazione.` });
      } finally {
        setIsDeleting(false);
      }
    };


  // --- Memos for Display ---
  const groupedAppointments = useMemo(() => {
    return groupItemsByPatientAndTime(appointments);
  }, [appointments]);

  // Separate groups based on *current* completion status from local state
  const upcomingAppointmentGroups = useMemo(() => {
    return Object.entries(groupedAppointments).filter(([, items]) =>
      items.some(item => !itemCompletionStatus[item.id]) // Group is upcoming if ANY item is not complete
    ).sort(([keyA], [keyB]) => {
        const timeA = keyA.split('-').pop() || 'N/D';
        const timeB = keyB.split('-').pop() || 'N/D';
         if (timeA === 'N/D' && timeB === 'N/D') return 0; // Keep original relative order if times are same/N/D
         if (timeA === 'N/D') return 1; // Put N/D times at the end
         if (timeB === 'N/D') return -1;
        return timeA.localeCompare(timeB); // Sort by time ascending
    });
  }, [groupedAppointments, itemCompletionStatus]);

  const completedAppointmentGroups = useMemo(() => {
    return Object.entries(groupedAppointments).filter(([, items]) =>
      items.every(item => itemCompletionStatus[item.id]) // Group is completed only if ALL items are complete
    ).sort(([keyA], [keyB]) => {
        const timeA = keyA.split('-').pop() || 'N/D';
        const timeB = keyB.split('-').pop() || 'N/D';
         if (timeA === 'N/D' && timeB === 'N/D') return 0;
         if (timeA === 'N/D') return 1;
         if (timeB === 'N/D') return -1;
        return timeA.localeCompare(timeB);
    });
  }, [groupedAppointments, itemCompletionStatus]);


   // Render loading skeleton if auth is resolving OR data is loading OR client not ready
   if (authLoading || isLoading || !isClientReady) {
     return (
       <>
         <header className={cn(
             "bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10"
         )}>
            <Skeleton className="h-7 w-40 rounded bg-primary/80 mx-auto mb-1" />
            <Skeleton className="h-4 w-56 rounded bg-primary/80 mx-auto" />
         </header>
         <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 pb-24">
            <div>
                <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                   <Skeleton className="w-5 h-5 rounded bg-muted" />
                   <Skeleton className="h-6 w-32 rounded bg-muted" />
                </h2>
                 <div className="grid gap-4">
                    <AppointmentCardSkeleton />
                    <AppointmentCardSkeleton />
                 </div>
            </div>
             <div>
                <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded bg-muted" />
                    <Skeleton className="h-6 w-28 rounded bg-muted" />
                </h2>
                 <div className="grid gap-4">
                     <AppointmentCardSkeleton />
                 </div>
             </div>
         </main>
       </>
     );
   }

   // If not loading, but no user exists (and client is ready), show minimal loader during redirect
   if (!user && isClientReady) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
                {/* Minimal loader during redirect */}
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
         );
   }

   // Render content only if user exists and client is ready
   if (!user) {
        // This case should not be reached due to useEffect redirect
        return null;
   }

  return (
    <>
      <header className={cn(
          "bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 text-center" // Added text-center
      )}>
        {/* Title */}
        <h1 className={cn("text-xl md:text-2xl font-bold")}>CareTrack Mobile</h1>
         {/* Date Display - Make it slightly larger and less muted */}
        <ClientDateDisplay
          locale="it-IT"
          formatOptions={dateOptions}
          className={cn("block text-sm md:text-base text-primary-foreground/90 mt-1")} // Adjusted size/opacity
         />
      </header>

      <main className="flex-grow p-4 md:p-6 lg:p-8 space-y-6 pb-24">
        {/* Upcoming Appointments Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
             <Square className="w-5 h-5 text-primary" /> Da Completare
          </h2>
          {upcomingAppointmentGroups.length > 0 ? (
            <div className="grid gap-4">
              {upcomingAppointmentGroups.map(([groupKey, items]) => {
                 const firstItem = items[0];
                 const timeDisplay = firstItem.time || 'N/D';

                 return (
                    <Card key={groupKey} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                       <CardHeader className="p-4 bg-accent/10 border-b border-border">
                           <Link href={`/patient/${firstItem.patientId}`} passHref legacyBehavior>
                              <a className="block group">
                                 <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2 group-hover:underline cursor-pointer">
                                    <User className="w-5 h-5" />
                                    {firstItem.patientName}
                                 </CardTitle>
                              </a>
                           </Link>
                           <CardDescription className="text-sm text-muted-foreground pt-1 flex items-center gap-1.5">
                              <Building className="w-4 h-4" />
                              {firstItem.companyName}
                           </CardDescription>
                            {/* Patient Contact Number */}
                            {firstItem.patientContact && (
                                <a href={`tel:${firstItem.patientContact.replace(/\s/g, '')}`} className="text-sm text-muted-foreground pt-1 flex items-center gap-1.5 hover:text-primary hover:underline w-fit">
                                    <Phone className="w-4 h-4" />
                                    {firstItem.patientContact}
                                </a>
                            )}
                           <div className="text-sm text-muted-foreground pt-2 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-accent" />
                                <span>Orario: {timeDisplay}</span>
                           </div>
                       </CardHeader>
                       <CardContent className="p-4 grid gap-3 text-sm">
                         {items.map((appointment) => (
                            <div key={appointment.id} className="flex items-center justify-between gap-3 border-b border-dashed border-border/50 pb-2 last:border-b-0 last:pb-0">
                               <div className="flex items-start gap-2 flex-grow min-w-0">
                                    <Checkbox
                                        id={`complete-${appointment.id}`}
                                        checked={itemCompletionStatus[appointment.id] ?? false}
                                        onCheckedChange={(checked) => handleCompletionChange(appointment.id, checked)}
                                        aria-label={`Segna ${appointment.planName || appointment.description || 'impegno'} come completato`}
                                        className="mt-0.5 shrink-0"
                                        disabled={isCompleting[appointment.id]} // Disable while processing
                                    />
                                     <Label htmlFor={`complete-${appointment.id}`} className="flex-grow cursor-pointer">
                                        {isCompleting[appointment.id] && <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 text-primary" />}
                                        {appointment.isPlanBased && appointment.planName && (
                                            <span className="flex items-center gap-1.5">
                                                <ListChecks className="w-4 h-4 text-accent shrink-0" />
                                                <span>Piano: {appointment.planName}</span>
                                            </span>
                                        )}
                                        {!appointment.isPlanBased && appointment.description && (
                                            <span className="flex items-center gap-1.5">
                                                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                                <span>{appointment.description}</span>
                                            </span>
                                        )}
                                        {/* Show duration */}
                                         {appointment.durationMinutes !== undefined && (
                                             <span className="block text-xs text-muted-foreground mt-1 pl-5 italic flex items-center gap-1">
                                                 <Timer className="w-3 h-3" />
                                                 {appointment.isPlanBased ? 'Durata Prev.: ' : 'Durata Eff.: '}
                                                 {appointment.durationMinutes} min
                                             </span>
                                         )}
                                    </Label>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Reschedule Popover */}
                                    <Popover open={showReschedulePopover === appointment.id} onOpenChange={(isOpen) => {
                                        if (!isOpen) {
                                            setShowReschedulePopover(null);
                                            setSelectedDate(undefined);
                                        } else {
                                             setShowReschedulePopover(appointment.id);
                                        }
                                    }}>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0" title="Posticipa questo impegno" disabled={isCompleting[appointment.id]}>
                                                <CalendarIcon className="w-4 h-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 z-[5000]" align="end">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDate}
                                                onSelect={(date) => {
                                                     setSelectedDate(date);
                                                     setShowReschedulePopover(null);
                                                     handleReschedule(appointment.id, appointment.isPlanBased, date);
                                                }}
                                                disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                                                initialFocus
                                                locale={it}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {/* Delete Button (only for non-plan based = logged service) */}
                                     {!appointment.isPlanBased && (
                                        <AlertDialog>
                                             <AlertDialogTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" title="Elimina prestazione registrata" onClick={() => setItemToDelete({ id: appointment.id, description: appointment.description || 'Prestazione' })} disabled={isCompleting[appointment.id]}>
                                                     <Trash2 className="w-4 h-4" />
                                                 </Button>
                                             </AlertDialogTrigger>
                                             {/* Content moved outside */}
                                         </AlertDialog>
                                     )}
                                </div>
                            </div>
                         ))}
                       </CardContent>
                     </Card>
                 );
              })}
            </div>
          ) : (
              <Card className="bg-card border border-border rounded-lg shadow-sm">
                  <CardContent className="p-6 text-center text-muted-foreground">
                      Nessun impegno da completare per oggi.
                  </CardContent>
              </Card>
          )}
        </div>

         {/* Completed Appointments Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
             <CheckSquare className="w-5 h-5 text-green-600" /> Completati
          </h2>
          {completedAppointmentGroups.length > 0 ? (
            <div className="grid gap-4">
             {completedAppointmentGroups.map(([groupKey, items]) => {
                 const firstItem = items[0];
                 const timeDisplay = firstItem.time || 'N/D';

                 return (
                     <Card key={groupKey} className="bg-card border border-border rounded-lg overflow-hidden shadow-sm opacity-70">
                         <CardHeader className="p-4 bg-muted/50 border-b border-border">
                             <Link href={`/patient/${firstItem.patientId}`} passHref legacyBehavior>
                                 <a className="block group">
                                     <CardTitle className="text-lg font-semibold text-muted-foreground flex items-center gap-2 group-hover:text-primary cursor-pointer">
                                         <User className="w-5 h-5" />
                                         {firstItem.patientName}
                                     </CardTitle>
                                 </a>
                             </Link>
                             <CardDescription className="text-sm text-muted-foreground pt-1 flex items-center gap-1.5">
                                 <Building className="w-4 h-4" />
                                 {firstItem.companyName}
                             </CardDescription>
                               {/* Patient Contact Number */}
                              {firstItem.patientContact && (
                                  <a href={`tel:${firstItem.patientContact.replace(/\s/g, '')}`} className="text-sm text-muted-foreground pt-1 flex items-center gap-1.5 hover:text-primary hover:underline w-fit">
                                      <Phone className="w-4 h-4" />
                                      {firstItem.patientContact}
                                  </a>
                              )}
                              <div className="text-sm text-muted-foreground pt-2 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-accent" />
                                <span>Orario: {timeDisplay}</span>
                              </div>
                         </CardHeader>
                         <CardContent className="p-4 grid gap-3 text-sm">
                             {items.map((appointment) => (
                                 <div key={appointment.id} className="flex items-center justify-between gap-3 border-b border-dashed border-border/50 pb-2 last:border-b-0 last:pb-0">
                                     <div className="flex items-start gap-2 flex-grow">
                                         <Checkbox
                                             id={`complete-${appointment.id}`}
                                             checked={itemCompletionStatus[appointment.id] ?? false}
                                             onCheckedChange={(checked) => handleCompletionChange(appointment.id, checked)}
                                             aria-label={`Segna ${appointment.planName || appointment.description || 'impegno'} come da completare`}
                                             className="mt-0.5 shrink-0"
                                             disabled={isCompleting[appointment.id]} // Disable while processing
                                         />
                                         <Label htmlFor={`complete-${appointment.id}`} className="flex-grow cursor-pointer">
                                             {isCompleting[appointment.id] && <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 text-primary" />}
                                             {appointment.isPlanBased && appointment.planName && (
                                                <span className="flex items-center gap-1.5">
                                                    <ListChecks className="w-4 h-4 text-accent shrink-0" />
                                                    <span>Piano: {appointment.planName}</span>
                                                </span>
                                             )}
                                              {!appointment.isPlanBased && appointment.description && (
                                                  <span className="flex items-center gap-1.5">
                                                     <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                                     <span>{appointment.description}</span>
                                                 </span>
                                              )}
                                                {appointment.durationMinutes !== undefined && (
                                                     <span className="block text-xs text-muted-foreground mt-1 pl-5 italic flex items-center gap-1">
                                                         <Timer className="w-3 h-3" />
                                                          Durata Eff.: {appointment.durationMinutes} min
                                                     </span>
                                                )}
                                         </Label>
                                     </div>
                                     <div className="flex items-center gap-1 shrink-0">
                                         {/* Delete Button for completed services */}
                                         {!appointment.isPlanBased && (
                                             <AlertDialog>
                                                 <AlertDialogTrigger asChild>
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" title="Elimina prestazione registrata" onClick={() => setItemToDelete({ id: appointment.id, description: appointment.description || 'Prestazione' })} disabled={isCompleting[appointment.id]}>
                                                         <Trash2 className="w-4 h-4" />
                                                     </Button>
                                                 </AlertDialogTrigger>
                                                 {/* Content moved outside */}
                                             </AlertDialog>
                                         )}
                                     </div>
                                 </div>
                             ))}
                         </CardContent>
                     </Card>
                 );
             })}
            </div>
          ) : (
              <Card className="bg-card border border-border rounded-lg shadow-sm">
                  <CardContent className="p-6 text-center text-muted-foreground">
                      Nessun impegno completato per oggi.
                  </CardContent>
              </Card>
          )}
        </div>

         {/* Delete Confirmation Dialog */}
         <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                      <AlertDialogDescription>
                         Stai per eliminare la prestazione registrata "<span className="font-bold">{itemToDelete?.description}</span>". Questa azione non può essere annullata.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                         {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                         {isDeleting ? 'Eliminazione...' : 'Elimina'}
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
         </AlertDialog>
      </main>
    </>
  );
};

export default HomePage;

    
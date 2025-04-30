
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar as ShadCalendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Corrected import
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { format, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth, isSameDay } from 'date-fns'; // Import isSameDay
import type { DateRange } from 'react-day-picker';
import { it } from 'date-fns/locale';
import { Clock, Building, ClipboardList, Calendar as CalendarIcon, Download, FileText, FileSpreadsheet, Loader2, CheckSquare, Square, Timer, Info, Trash2 } from 'lucide-react'; // Added Trash2
import type { Service, Patient, Company, Plan, Appointment } from '@/lib/types';
import {
    getAllServices,
    getAllPatients,
    getAllCompanies,
    getAllPlans,
    getPatient,
    getCompany,
    getPlan,
    getAssignedPlansForPatient,
    getServicesByCompanyForPeriod,
    getAllServicesForPeriod,
    addService, // Import addService
    deleteData // Import deleteData for potential service deletion
} from '@/lib/firebase/firestore-utils';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
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

// Combined type for display (consistent with homepage)
type CalendarItem = Appointment & { itemType: 'service' | 'plan' };

// Skeleton for Event List Item
const EventListItemSkeleton: FC = () => (
    <AccordionItem value={Math.random().toString()} className="border-b">
        <AccordionTrigger className="hover:no-underline">
            <div className="flex justify-between items-center w-full text-left">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
            </div>
        </AccordionTrigger>
        <AccordionContent className="text-sm">
            <Skeleton className="h-4 w-full mb-2 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
            <Skeleton className="h-3 w-3/4 mt-1 rounded" />
        </AccordionContent>
    </AccordionItem>
);

// Helper function to group items by patient and time (consistent with homepage)
const groupItemsByPatientAndTime = (items: CalendarItem[]): Record<string, CalendarItem[]> => {
    const grouped: Record<string, CalendarItem[]> = {};
    items.forEach(item => {
        const timeKey = item.time || 'N/D';
        const patientIdKey = item.patientId.trim(); // Ensure consistent patient ID key
        const groupKey = `${patientIdKey}-${timeKey}`;
        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }
        grouped[groupKey].push(item);
    });
    return grouped;
};


const CalendarPage: FC = () => {
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, Patient>>({});
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({});
  const [plansMap, setPlansMap] = useState<Record<string, Plan>>({});
  const [itemCompletionStatus, setItemCompletionStatus] = useState<Record<string, boolean>>({}); // Completion status state
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState<Record<string, boolean>>({}); // Loading state per item
  const [isExporting, setIsExporting] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; description: string } | null>(null); // State for delete confirmation
  const [isDeleting, setIsDeleting] = useState(false); // State for deletion loading


  // State for export filters
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedCompanyIdForExport, setSelectedCompanyIdForExport] = useState<string>('all');

   useEffect(() => {
    setIsClientReady(true);
   }, []);

   const showToast = useCallback(toast, []);

  // --- Data Loading ---
  const loadCalendarData = useCallback(async () => {
        setIsLoading(true);
        console.log("CalendarPage: Starting data fetch...");
        try {
            // Fetch ALL services initially, regardless of date
            const [services, patients, companies, plans] = await Promise.all([
                getAllServices(), // Fetch all services
                getAllPatients(),
                getAllCompanies(),
                getAllPlans(),
            ]);
            console.log("CalendarPage: Fetched core data.");

            const fetchedPatientsMap = Object.fromEntries(patients.map(p => [p.id, p]));
            const fetchedCompaniesMap = Object.fromEntries(companies.map(c => [c.id, c]));
            const fetchedPlansMap = Object.fromEntries(plans.map(p => [p.id, p]));
            setPatientsMap(fetchedPatientsMap);
            setCompaniesMap(fetchedCompaniesMap);
            setPlansMap(fetchedPlansMap);

            const allItems: CalendarItem[] = [];
            const addedPlanInstanceIds = new Set<string>();
            const initialCompletionStatus: Record<string, boolean> = {};

            // Process ALL Services (Historical, Today, Future if any)
            services.forEach(service => {
                const patient = fetchedPatientsMap[service.patientId];
                const company = patient ? fetchedCompaniesMap[patient.companyId] : undefined;
                allItems.push({
                    id: service.id,
                    patientName: patient?.name || 'Paziente Sconosciuto',
                    time: service.startTime || 'N/D',
                    companyName: company?.name || 'Azienda Sconosciuta',
                    patientId: service.patientId,
                    description: service.description,
                    isCompleted: true, // Logged services are implicitly complete
                    isPlanBased: false,
                    date: service.date, // Date object from Firestore utils
                    planName: undefined,
                    itemType: 'service',
                    durationMinutes: service.durationMinutes
                });
                initialCompletionStatus[service.id] = true; // Mark service as complete
            });
            console.log("CalendarPage: Processed services.");

            // Process ALL Scheduled Plans (Historical, Today, Future)
            await Promise.all(patients.map(async (patient) => {
                const assignedPlans = await getAssignedPlansForPatient(patient.id);
                 for (const assignedPlan of assignedPlans) {
                    if (!assignedPlan.scheduledInstances) continue;

                    for (const instance of assignedPlan.scheduledInstances) {
                         if (instance.date) { // Check if date exists (Date object)
                            const plan = fetchedPlansMap[assignedPlan.planId];
                            const planName = plan?.name || 'Piano Sconosciuto';
                            const company = fetchedCompaniesMap[patient.companyId];
                            const dateISOForId = instance.date.toISOString().split('T')[0];
                            // Create a unique ID combining patient, plan, and date
                            const instanceId = `plan-${patient.id}-${assignedPlan.planId}-${dateISOForId}`;

                            // Check if a SERVICE matching this specific plan instance exists *anywhere* in the fetched services
                            const loggedAsService = allItems.some(item =>
                                item.itemType === 'service' &&
                                isSameDay(item.date, instance.date) && // Check date match
                                item.patientId === patient.id &&
                                (item.description === `Piano: ${planName}` || (planName !== 'Piano Sconosciuto' && item.description?.includes(planName))) &&
                                (item.time === instance.time || !instance.time || instance.time === 'N/D')
                            );

                            // Add the plan instance if it hasn't been logged as a service yet AND hasn't been added already
                            if (!loggedAsService && !addedPlanInstanceIds.has(instanceId)) {
                                allItems.push({
                                    id: instanceId,
                                    patientName: patient.name,
                                    time: instance.time || 'N/D',
                                    companyName: company?.name || 'Azienda Sconosciuta',
                                    patientId: patient.id,
                                    description: `Piano: ${planName}`,
                                    planName: planName,
                                    isCompleted: false, // Planned items are not initially complete
                                    isPlanBased: true,
                                    date: instance.date,
                                    itemType: 'plan',
                                    durationMinutes: assignedPlan.customDuration ?? plan?.defaultDuration // Use assigned or default duration for plan
                                });
                                addedPlanInstanceIds.add(instanceId);
                                initialCompletionStatus[instanceId] = false; // Mark plan as incomplete initially
                            } else if (loggedAsService && !addedPlanInstanceIds.has(instanceId)) {
                                // If it *was* logged as a service, ensure its corresponding service ID has status 'true'
                                const correspondingService = allItems.find(item =>
                                    item.itemType === 'service' &&
                                    isSameDay(item.date, instance.date) &&
                                    item.patientId === patient.id &&
                                    (item.description === `Piano: ${planName}` || (planName !== 'Piano Sconosciuto' && item.description?.includes(planName))) &&
                                    (item.time === instance.time || !instance.time || instance.time === 'N/D')
                                );
                                if (correspondingService) {
                                     initialCompletionStatus[correspondingService.id] = true; // Ensure service is marked complete
                                }
                                // Ensure the original plan ID is not added if service exists
                                addedPlanInstanceIds.add(instanceId);
                            }
                        }
                    }
                 }
            }));
             console.log("CalendarPage: Processed assigned plans.");

            allItems.sort((a, b) => {
                 if (b.date.getTime() !== a.date.getTime()) {
                    return b.date.getTime() - a.date.getTime(); // Sort by date descending first
                 }
                 // If dates are the same, sort by time ascending (N/D last)
                 const timeA = a.time || 'N/D';
                 const timeB = b.time || 'N/D';
                 if (timeA === 'N/D' && timeB === 'N/D') return a.patientName.localeCompare(b.patientName); // If both N/D, sort by name
                 if (timeA === 'N/D') return 1; // N/D comes after specific times
                 if (timeB === 'N/D') return -1;
                 return timeA.localeCompare(timeB); // Sort specific times alphabetically/numerically
            });

            setCalendarItems(allItems);
            setItemCompletionStatus(initialCompletionStatus); // Set initial completion status
            console.log("CalendarPage: Data fetch successful.");

        } catch (error) {
            console.error("CalendarPage: Error loading calendar data:", error);
            showToast({ variant: "destructive", title: "Errore", description: "Impossibile caricare i dati del calendario." });
        } finally {
            console.log("CalendarPage: Setting loading to false.");
            setIsLoading(false);
        }
    }, [user, authLoading, isClientReady, showToast]); // Dependencies for loading

  useEffect(() => {
     if (!authLoading && user && isClientReady) {
        loadCalendarData();
     } else if (!authLoading && !user && isClientReady) {
         console.log("CalendarPage: No user, setting loading to false.");
         setIsLoading(false);
         setCalendarItems([]);
         setPatientsMap({});
         setCompaniesMap({});
         setPlansMap({});
         setItemCompletionStatus({}); // Reset completion status
     } else {
        setIsLoading(authLoading || !isClientReady);
        console.log(`CalendarPage: Waiting for auth/client ready. AuthLoading: ${authLoading}, ClientReady: ${isClientReady}`);
     }
   }, [user?.uid, authLoading, isClientReady, loadCalendarData]); // Use loadCalendarData in dependency array


    // --- Completion Handler (Updated to mirror HomePage logic) ---
    const handleCompletionChange = async (itemId: string, completed: boolean | 'indeterminate') => {
        if (completed === 'indeterminate' || isCompleting[itemId]) return;

        const item = calendarItems.find(calItem => calItem.id === itemId);
        if (!item || !user) {
            showToast({ variant: "destructive", title: "Errore", description: "Impossibile trovare l'impegno o utente non autenticato." });
            return;
        }

        setIsCompleting(prev => ({ ...prev, [itemId]: true })); // Start loading for this item

        // Optimistically update UI state first
        setItemCompletionStatus(prev => ({ ...prev, [itemId]: completed === true }));

        try {
            if (completed && item.isPlanBased) {
                // Mark a PLAN as complete -> Create a Service record
                console.log(`Completing Plan: ${itemId}`);
                const planIdMatch = item.id.match(/^plan-.+?-(.+?)-/); // Extract planId
                if (!planIdMatch || !planIdMatch[1]) throw new Error("Invalid plan item ID format");
                const planId = planIdMatch[1];
                const plan = plansMap[planId]; // Use cached plansMap
                if (!plan) throw new Error(`Dettagli del piano ${planId} non trovati`);

                const startTime = item.time !== 'N/D' ? item.time : format(new Date(), 'HH:mm');
                const duration = item.durationMinutes ?? plan.defaultDuration; // Use item's duration or default
                const endTimeDate = new Date(item.date); // Use the instance date!
                const [startH, startM] = startTime.split(':').map(Number);
                endTimeDate.setHours(startH, startM + duration, 0, 0);
                const endTime = format(endTimeDate, 'HH:mm');

                const servicePayload = {
                    patientId: item.patientId,
                    date: item.date,
                    startTime: startTime,
                    endTime: endTime,
                    description: `Piano: ${item.planName || plan.name}`, // Use plan name from item or map
                    userId: user.uid,
                };

                const addedService = await addService(servicePayload, duration);
                console.log(`Created Service: ${addedService.id} from Plan: ${itemId}`);

                // Update local state: replace plan item with service item
                setCalendarItems(prev => {
                    const newItems = prev.filter(i => i.id !== itemId); // Remove the plan item
                    const newServiceItem: CalendarItem = { // Create the service item
                         ...item, // Copy basic details
                         id: addedService.id, // Use the new service ID
                         isCompleted: true,
                         isPlanBased: false,
                         itemType: 'service',
                         time: addedService.startTime, // Use actual start/end times
                         durationMinutes: addedService.durationMinutes,
                         description: addedService.description, // Use service description
                    };
                    newItems.push(newServiceItem);
                    // Re-sort
                     newItems.sort((a, b) => {
                         if (b.date.getTime() !== a.date.getTime()) return b.date.getTime() - a.date.getTime();
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
                    delete newState[itemId]; // Remove old plan ID status
                    newState[addedService.id] = true; // Add new service ID status
                    return newState;
                 });

                showToast({
                    title: "Completato",
                    description: `Piano ${item.planName || ''} registrato come prestazione.`,
                    duration: 3000,
                });

            } else if (!completed && !item.isPlanBased) {
                // Unchecking a SERVICE -> Delete the Service record
                console.log(`Uncompleting Service: ${itemId}. Deleting service record...`);

                await deleteData('services', itemId);

                // Attempt to convert the service back into its corresponding Plan appointment
                const planMatch = item.description?.match(/^Piano: (.+)$/);
                const planNameFromDesc = planMatch ? planMatch[1] : null;
                let correspondingPlanId: string | null = null;
                if (planNameFromDesc) {
                    const matchedPlan = Object.values(plansMap).find(p => p.name === planNameFromDesc);
                    correspondingPlanId = matchedPlan?.id || null;
                }

                setCalendarItems(prev => {
                    const newItems = prev.filter(i => i.id !== itemId); // Remove the service item
                     // If we found a corresponding plan, add the plan instance back
                     if (correspondingPlanId) {
                        const planDateISO = item.date.toISOString().split('T')[0];
                        const planInstanceId = `plan-${item.patientId}-${correspondingPlanId}-${planDateISO}`;
                        const plan = plansMap[correspondingPlanId];
                        const patient = patientsMap[item.patientId];
                        const company = patient ? companiesMap[patient.companyId] : undefined;
                        // Check if this plan instance already exists (maybe added manually before)
                        const exists = newItems.some(existingItem => existingItem.id === planInstanceId);
                        if (!exists) {
                            newItems.push({
                                id: planInstanceId,
                                patientName: item.patientName,
                                time: item.time,
                                companyName: company?.name || 'Azienda Sconosciuta',
                                patientId: item.patientId,
                                description: `Piano: ${planNameFromDesc}`,
                                planName: planNameFromDesc || undefined,
                                isCompleted: false, // Now incomplete
                                isPlanBased: true,
                                date: item.date,
                                itemType: 'plan',
                                durationMinutes: plan?.defaultDuration, // Need assigned plan for custom duration
                            });
                        }
                     }
                    // Re-sort
                    newItems.sort((a, b) => {
                        if (b.date.getTime() !== a.date.getTime()) return b.date.getTime() - a.date.getTime();
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
                    delete newState[itemId]; // Remove old service ID status
                    // Add corresponding plan ID status if generated
                    if (correspondingPlanId) {
                        const planDateISO = item.date.toISOString().split('T')[0];
                        const planInstanceId = `plan-${item.patientId}-${correspondingPlanId}-${planDateISO}`;
                        newState[planInstanceId] = false;
                    }
                    return newState;
                 });

                 showToast({
                    title: "Da Completare",
                    description: `Prestazione "${item.description || ''}" riportata a da completare.`,
                    duration: 2000,
                 });

            } else if (completed && !item.isPlanBased) {
                // Re-checking a SERVICE visually (should not happen with delete logic)
                console.warn(`Re-checking service ${itemId}. This might indicate inconsistent state.`);
                 showToast({
                    title: "Completato",
                    description: `Prestazione "${item.description}" segnata come completata.`,
                    duration: 2000,
                });

            } else if (!completed && item.isPlanBased) {
                // Unchecking a PLAN visually
                console.log(`Marking Plan Visually Incomplete: ${itemId}`);
                 showToast({
                    title: "Da Completare",
                    description: `Piano "${item.planName}" segnato come da completare.`,
                    duration: 2000,
                });
            }
        } catch (error) {
            console.error("Error updating completion status:", error);
            showToast({ variant: "destructive", title: "Errore", description: "Impossibile aggiornare lo stato." });
            // Revert optimistic update on error
            setItemCompletionStatus(prev => ({ ...prev, [itemId]: !completed }));
            // Reload data on error
            loadCalendarData();
        } finally {
            setIsCompleting(prev => ({ ...prev, [itemId]: false })); // Stop loading for this item
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
        setCalendarItems(prev => prev.filter(app => app.id !== id));
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
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, CalendarItem[]> = {};
    calendarItems.forEach(item => {
        const dateKey = format(item.date, 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        grouped[dateKey].push(item);
         grouped[dateKey].sort((a, b) => {
            const timeA = a.time || 'N/D';
            const timeB = b.time || 'N/D';
            if (timeA === 'N/D' && timeB === 'N/D') return (a.patientName || '').localeCompare(b.patientName || '');
            if (timeA === 'N/D') return 1;
            if (timeB === 'N/D') return -1;
            return timeA.localeCompare(timeB);
         });
    });
    return grouped;
  }, [calendarItems]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(startOfDay(selectedDate), 'yyyy-MM-dd');
    return itemsByDate[dateKey] || [];
  }, [selectedDate, itemsByDate]);

  const groupedSelectedDayItems = useMemo(() => {
    return groupItemsByPatientAndTime(selectedDayItems);
  }, [selectedDayItems]);

   const eventDays = useMemo(() => {
       return Object.keys(itemsByDate).map(dateStr => startOfDay(new Date(dateStr + 'T00:00:00')));
   }, [itemsByDate]);


  const getPatientName = (patientId: string) => patientsMap[patientId]?.name || 'Paziente Sconosciuto';
  const getCompanyName = (patientId: string) => {
      const patient = patientsMap[patientId];
      return patient ? (companiesMap[patient.companyId]?.name || 'Azienda Sconosciuta') : 'Azienda Sconosciuta';
  }

  // --- Export Functionality ---
  const handleExport = async (formatType: 'pdf' | 'excel') => {
    if (!exportDateRange?.from || !exportDateRange?.to) {
        showToast({ variant: 'destructive', title: 'Errore', description: 'Seleziona un intervallo di date valido per l\'esportazione.' });
        return;
    }
    if (isExporting) return;

    setIsExporting(true);
    showToast({ title: 'Esportazione in corso...', description: `Preparazione del file ${formatType.toUpperCase()}...` });

    try {
        const exportStart = startOfDay(exportDateRange.from);
        const exportEnd = endOfDay(exportDateRange.to);

        // Fetch necessary data maps if they aren't fresh (consider caching strategy)
        const currentPatientsMap = Object.keys(patientsMap).length > 0 ? patientsMap : Object.fromEntries((await getAllPatients()).map(p => [p.id, p]));
        const currentCompaniesMap = Object.keys(companiesMap).length > 0 ? companiesMap : Object.fromEntries((await getAllCompanies()).map(c => [c.id, c]));

        let servicesToExport: Service[];
        if (selectedCompanyIdForExport === 'all') {
            servicesToExport = await getAllServicesForPeriod(exportStart, exportEnd);
        } else {
            servicesToExport = await getServicesByCompanyForPeriod(selectedCompanyIdForExport, exportStart, exportEnd);
        }

        if (servicesToExport.length === 0) {
            const companyName = selectedCompanyIdForExport === 'all'
                ? 'Tutte le Aziende'
                : currentCompaniesMap[selectedCompanyIdForExport]?.name || 'Azienda Sconosciuta';
            showToast({ variant: 'destructive', title: 'Nessun Dato', description: `Nessuna prestazione trovata per ${companyName} nell'intervallo selezionato.` });
            setIsExporting(false);
            return;
        }

        const totalMinutes = servicesToExport.reduce((sum, service) => sum + (service.durationMinutes || 0), 0);

        const exportData = servicesToExport.map(service => ({
            Data: service.date ? format(service.date, 'dd/MM/yyyy', { locale: it }) : 'Data Invalida',
            OraInizio: service.startTime || 'N/D',
            OraFine: service.endTime || 'N/D',
            Paziente: currentPatientsMap[service.patientId]?.name || 'Paziente Sconosciuto',
            Azienda: currentCompaniesMap[currentPatientsMap[service.patientId]?.companyId]?.name || 'Azienda Sconosciuta',
            Descrizione: service.description,
            DurataMinuti: service.durationMinutes || 0,
        }));

        const startDateStr = format(exportDateRange.from, 'dd-MM-yyyy');
        const endDateStr = format(exportDateRange.to, 'dd-MM-yyyy');
        const companyName = selectedCompanyIdForExport === 'all' ? 'Tutte' : currentCompaniesMap[selectedCompanyIdForExport]?.name || 'Sconosciuta';
        const companyFilePart = selectedCompanyIdForExport === 'all' ? 'Tutte' : companyName.replace(/\s+/g, '_');
        const filename = `Report_Prestazioni_${companyFilePart}_${startDateStr}_${endDateStr}`;
        const reportTitle = `Report Prestazioni Erogate (${companyName} - ${startDateStr} - ${endDateStr})`;


        if (formatType === 'pdf') {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.setTextColor(40);
            doc.text(reportTitle, 14, 15);

            autoTable(doc, {
                head: [['Data', 'Ora Inizio', 'Ora Fine', 'Paziente', 'Azienda', 'Descrizione', 'Durata (Min)']],
                body: exportData.map(Object.values),
                startY: 25,
                theme: 'grid',
                headStyles: { fillColor: [0, 121, 107], textColor: 255 },
                footStyles: { fontStyle: 'bold', fillColor: [224, 224, 224], textColor: 40 },
                foot: [
                     [{ content: `Totale Ore: ${Math.floor(totalMinutes / 60)} ore e ${totalMinutes % 60} minuti`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 224, 224], textColor: 40 } }],
                ],
            });
            doc.save(`${filename}.pdf`);
        } else if (formatType === 'excel') {
             const dataWithTotal = [
                ...exportData,
                {},
                { Data: '', OraInizio: '', OraFine: '', Paziente: '', Azienda: '', Descrizione: 'Totale Ore:', DurataMinuti: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` }
             ];
             const worksheet = XLSX.utils.json_to_sheet(dataWithTotal, { header: ["Data", "OraInizio", "OraFine", "Paziente", "Azienda", "Descrizione", "DurataMinuti"], skipHeader: false });
             if(worksheet['G1']) worksheet['G1'].v = 'Durata (Min)';
             const workbook = XLSX.utils.book_new();
             workbook.Props = { Title: reportTitle };
             XLSX.utils.book_append_sheet(workbook, worksheet, `Prestazioni_${companyFilePart}`);
              const columnWidths = [
                    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 40 }, { wch: 15 }
              ];
              worksheet['!cols'] = columnWidths;
             XLSX.writeFile(workbook, `${filename}.xlsx`);
        }

        showToast({ title: 'Esportazione Completata', description: `File ${filename}.${formatType} generato.` });

    } catch (error) {
        console.error("CalendarPage: Export error:", error);
        showToast({ variant: 'destructive', title: 'Errore Esportazione', description: 'Si è verificato un problema durante la generazione del file.' });
    } finally {
        setIsExporting(false);
    }
  };
  // --- End Export Functionality ---


   if ((isLoading || authLoading) && isClientReady) {
    console.log(`CalendarPage: Rendering skeleton. IsLoading: ${isLoading}, AuthLoading: ${authLoading}`);
    return (
        <>
            <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-center">Calendario Prestazioni</h1>
            </header>
             <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">
                 <Card className="bg-card border border-border rounded-lg shadow-sm">
                     <CardHeader className="p-4 border-b">
                         <Skeleton className="h-6 w-36 rounded" />
                         <Skeleton className="h-4 w-full mt-2 rounded" />
                     </CardHeader>
                     <CardContent className="p-4 flex justify-center">
                          <Skeleton className="rounded-md border h-[350px] w-[320px]" />
                     </CardContent>
                 </Card>
                  <Card className="bg-card border border-border rounded-lg shadow-sm">
                      <CardHeader className="bg-accent/10 border-b border-border p-4">
                           <Skeleton className="h-6 w-48 rounded" />
                           <Skeleton className="h-4 w-full mt-2 rounded" />
                      </CardHeader>
                      <CardContent className="p-4">
                         <Accordion type="single" collapsible className="w-full">
                            <EventListItemSkeleton />
                            <EventListItemSkeleton />
                            <EventListItemSkeleton />
                         </Accordion>
                      </CardContent>
                  </Card>
                  <Card className="bg-card border border-border rounded-lg shadow-sm mt-auto">
                       <CardHeader className="p-4 border-b">
                           <Skeleton className="h-6 w-44 rounded" />
                            <Skeleton className="h-4 w-full mt-2 rounded" />
                       </CardHeader>
                       <CardContent className="p-4 grid md:grid-cols-2 gap-6 items-start">
                           <div className="flex flex-col space-y-4">
                                <Skeleton className="h-5 w-24 rounded" />
                                <Skeleton className="h-10 w-full md:w-[260px] rounded" />
                                <Skeleton className="h-10 w-full md:w-[260px] rounded" />
                           </div>
                           <div className="flex flex-col space-y-4 items-center md:items-start">
                               <Skeleton className="h-5 w-32 rounded" />
                               <div className="flex flex-col sm:flex-row gap-2 w-full justify-center md:justify-start">
                                    <Skeleton className="h-9 w-full sm:w-24 rounded" />
                                    <Skeleton className="h-9 w-full sm:w-24 rounded" />
                               </div>
                           </div>
                       </CardContent>
                  </Card>
             </main>
        </>
    );
   }

    if (!authLoading && !user && isClientReady) {
        // Redirect handled by AuthProvider, show loader while redirecting
         return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
                 <Loader2 className="h-10 w-10 animate-spin text-primary" />
                 <p className="mt-4 text-muted-foreground">Accesso richiesto...</p>
             </div>
         );
    }


   if (user && !isLoading && isClientReady) {
        console.log("CalendarPage: Rendering actual content.");
        return (
            <>
            <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-center">Calendario Prestazioni</h1>
            </header>

            <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">

                {/* Calendar View Card */}
                <Card className="bg-card border border-border rounded-lg shadow-sm">
                    <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5" />
                            Visualizza Giornata
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground pt-1">
                            Seleziona una data per vedere gli eventi. I giorni con eventi sono evidenziati.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 flex justify-center">
                        <ShadCalendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md border"
                            locale={it}
                            modifiers={{ eventDay: eventDays }}
                            modifiersClassNames={{
                                selected: '!bg-primary !text-primary-foreground',
                                today: cn('!bg-accent !text-accent-foreground', selectedDate && isSameDay(new Date(), selectedDate) ? '!bg-primary !text-primary-foreground' : ''),
                                eventDay: '!border !border-accent !font-bold',
                            }}
                        />
                    </CardContent>
                </Card>


                {/* Events List Card */}
                <Card className="bg-card border border-border rounded-lg shadow-sm">
                <CardHeader className="bg-accent/10 border-b border-border p-4">
                    <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                    <ClipboardList className="w-6 h-6" />
                    {selectedDate ? `Eventi del ${format(selectedDate, 'dd MMMM yyyy', { locale: it })}` : 'Seleziona una data per vedere gli eventi'}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground pt-1">
                        Mostra sia le prestazioni erogate che quelle pianificate, raggruppate per paziente e orario.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    {Object.keys(groupedSelectedDayItems).length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {Object.entries(groupedSelectedDayItems)
                            .sort(([keyA], [keyB]) => {
                                const timeA = keyA.split('-').pop() || 'N/D';
                                const timeB = keyB.split('-').pop() || 'N/D';
                                if (timeA === 'N/D' && timeB === 'N/D') {
                                    const patientA = patientsMap[keyA.split('-')[0]]?.name || '';
                                    const patientB = patientsMap[keyB.split('-')[0]]?.name || '';
                                    return patientA.localeCompare(patientB);
                                }
                                if (timeA === 'N/D') return 1;
                                if (timeB === 'N/D') return -1;
                                return timeA.localeCompare(timeB);
                            })
                            .map(([groupKey, items]) => {
                                const firstItem = items[0];
                                const timeDisplay = firstItem.time || 'N/D';
                                // Determine overall group status based on *all* items within it
                                const allCompleted = items.every(item => itemCompletionStatus[item.id]);

                                return (
                                    <AccordionItem value={groupKey} key={groupKey}>
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex justify-between items-center w-full text-left">
                                                <span className={`flex items-center gap-2 font-medium text-foreground`}>
                                                     {allCompleted ? (
                                                        <CheckSquare className="w-4 h-4 text-green-600" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-primary" />
                                                    )}
                                                    {firstItem.patientName}
                                                </span>
                                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-4 h-4 text-accent"/>
                                                    {timeDisplay}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="text-sm">
                                            {items.map((item, index) => (
                                                <div key={`${item.id}-${index}`} className="mb-2 pl-1 border-l-2 border-transparent group-hover:border-accent transition-colors duration-200 first:mt-0 last:mb-0">
                                                     <div className="flex items-center gap-2 mb-1">
                                                        <Checkbox
                                                            id={`complete-cal-${item.id}`}
                                                            checked={itemCompletionStatus[item.id] ?? false}
                                                            onCheckedChange={(checked) => handleCompletionChange(item.id, checked)}
                                                            aria-label={`Segna ${item.planName || item.description || 'impegno'} come completato`}
                                                            className="shrink-0"
                                                            disabled={isCompleting[item.id]}
                                                        />
                                                         <Label htmlFor={`complete-cal-${item.id}`} className="flex-grow cursor-pointer">
                                                             {isCompleting[item.id] && <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 text-primary"/>}
                                                             {item.description}
                                                         </Label>
                                                         {/* Delete Button for completed/logged services */}
                                                         {!item.isPlanBased && (
                                                             <AlertDialog>
                                                                  <AlertDialogTrigger asChild>
                                                                       <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" title="Elimina prestazione registrata" onClick={() => setItemToDelete({ id: item.id, description: item.description || 'Prestazione' })} disabled={isCompleting[item.id]}>
                                                                          <Trash2 className="w-3.5 h-3.5" />
                                                                       </Button>
                                                                  </AlertDialogTrigger>
                                                                  {/* Content moved outside */}
                                                             </AlertDialog>
                                                         )}
                                                    </div>

                                                    {item.durationMinutes !== undefined && (
                                                         <div className="flex items-center gap-1 text-xs text-muted-foreground pl-7">
                                                            <Timer className="w-3 h-3" />
                                                            <span>Durata {item.isPlanBased ? 'Prev.' : 'Eff.'}: {item.durationMinutes} min</span>
                                                          </div>
                                                    )}
                                                    {item.itemType === 'plan' && ( // Removed !item.isCompleted check
                                                        <p className="text-xs text-muted-foreground italic mt-0.5 pl-7">Evento Pianificato</p>
                                                    )}
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-2 text-muted-foreground pl-1 mt-2 pt-2 border-t">
                                                <Building className="w-4 h-4 text-accent" />
                                                <span>Azienda: {firstItem.companyName}</span>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                        })}
                    </Accordion>
                    ) : selectedDate ? (
                    <p className="text-center text-muted-foreground">Nessun evento trovato per questa data.</p>
                    ) : (
                    <p className="text-center text-muted-foreground">Seleziona una data dal calendario.</p>
                    )}
                </CardContent>
                </Card>

                {/* Export Section Card */}
                <Card className="bg-card border border-border rounded-lg shadow-sm mt-auto">
                    <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
                            <Download className="w-5 h-5" />
                            Esporta Report Prestazioni
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground pt-1">
                            Esporta le prestazioni erogate in un intervallo di date, filtrando per azienda. Include il totale ore.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 grid md:grid-cols-2 gap-6 items-start">
                        <div className="flex flex-col space-y-4">
                            <Label className="font-medium">Filtri Esportazione</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date" variant={"outline"}
                                        className="w-full md:w-[260px] justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {exportDateRange?.from ? (
                                            exportDateRange.to ? (
                                                <>
                                                    {format(exportDateRange.from, "LLL dd, y", { locale: it })} -{" "}
                                                    {format(exportDateRange.to, "LLL dd, y", { locale: it })}
                                                </>
                                            ) : ( format(exportDateRange.from, "LLL dd, y", { locale: it }) )
                                        ) : ( <span>Seleziona intervallo</span> )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[5000]" align="start">
                                    <ShadCalendar
                                        initialFocus mode="range" defaultMonth={exportDateRange?.from}
                                        selected={exportDateRange} onSelect={setExportDateRange}
                                        numberOfMonths={1} locale={it}
                                    />
                                </PopoverContent>
                            </Popover>
                            <Select
                                value={selectedCompanyIdForExport}
                                onValueChange={setSelectedCompanyIdForExport}
                                disabled={isExporting}
                            >
                                <SelectTrigger className="w-full md:w-[260px]">
                                <SelectValue placeholder="Filtra per Azienda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tutte le Aziende</SelectItem>
                                    {Object.values(companiesMap).map((company) => (
                                        <SelectItem key={company.id} value={company.id}>
                                            {company.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col space-y-4 items-center md:items-start">
                            <Label className="font-medium text-center md:text-left">Formato Esportazione</Label>
                            <div className="flex flex-col sm:flex-row gap-2 w-full justify-center md:justify-start">
                                <Button
                                    onClick={() => handleExport('pdf')}
                                    disabled={isExporting || !exportDateRange?.from || !exportDateRange?.to}
                                    variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto"
                                >
                                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    PDF
                                </Button>
                                <Button
                                    onClick={() => handleExport('excel')}
                                    disabled={isExporting || !exportDateRange?.from || !exportDateRange?.to}
                                    variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto"
                                >
                                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                Excel
                                </Button>
                            </div>
                            {isExporting && <p className="text-sm text-muted-foreground text-center md:text-left">Esportazione in corso...</p>}
                        </div>
                    </CardContent>
                </Card>

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
    }

     console.log(`CalendarPage: Rendering fallback loader (unexpected state). IsLoading: ${isLoading}, AuthLoading: ${authLoading}, ClientReady: ${isClientReady}, User: ${!!user}`);
     return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <p className="mt-2 text-muted-foreground">Caricamento...</p>
         </div>
     );
};

export default CalendarPage;

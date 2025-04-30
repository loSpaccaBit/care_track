

'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
// Use only the main Dialog for the modal itself
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as ShadCalendar } from '@/components/ui/calendar'; // Renamed to avoid conflict
import { ScrollArea } from '@/components/ui/scroll-area';
// Use Popover for the date picker trigger/content consistently
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Still needed for other selects potentially, keep for now
import { X, Calendar as CalendarIcon, Clock, Timer, Trash2, Copy, Sigma, ChevronsRight, ArrowRight, Info, Bot, Loader2 } from 'lucide-react';
import type { Patient, Plan, AssignedPlan, ScheduledInstance } from '@/lib/types';
import { format, parseISO, isSameDay, startOfDay, isValid, addDays, differenceInDays, getDay, set } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DateRange } from "react-day-picker"; // Keep if manual date picking uses range, otherwise remove

interface PatientPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  availablePlans: Plan[];
  onSave: (patientId: string, assignedPlans: AssignedPlan[]) => Promise<void>; // Make onSave async
}

// Helper type for N-Instance generation state
type NInstanceGenerationState = {
    startDate: Date | undefined;
    selectedDaysOfWeek: number[];
    time: string | undefined;
}

const daysOfWeekMap: { [key: number]: string } = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab', 0: 'Dom' };

// Helper function to generate N instances based on start date, days, and total required
const generateNInstancesOnDays = (
    startDate: Date | undefined,
    totalRequired: number | undefined,
    selectedDaysOfWeek: number[],
    time: string | undefined
): ScheduledInstance[] => {
    if (!startDate || !totalRequired || totalRequired <= 0 || selectedDaysOfWeek.length === 0) {
        return [];
    }

    const start = startOfDay(startDate);
    const instances: ScheduledInstance[] = [];
    let currentDate = start;
    let count = 0;

    while (count < totalRequired) {
        const dayOfWeek = getDay(currentDate);
        if (selectedDaysOfWeek.includes(dayOfWeek)) {
            instances.push({ date: new Date(currentDate), time });
            count++;
        }
        currentDate = addDays(currentDate, 1);
        // Add a safeguard against infinite loops (e.g., if totalRequired is huge or no days selected)
        if (instances.length > totalRequired * 7 + 30) { // Arbitrary limit
            console.error("Exceeded generation limit for N instances. Check parameters.");
            break;
        }
    }

    return instances.sort((a, b) => a.date.getTime() - b.date.getTime());
};


const PatientPlanModal: FC<PatientPlanModalProps> = ({ isOpen, onClose, patient, availablePlans, onSave }) => {
  const { toast } = useToast();
  const [assignedPlansMapState, setAssignedPlansMapState] = useState<Record<string, AssignedPlan>>({});
  const [availablePlansMap, setAvailablePlansMap] = useState<Record<string, Plan>>({});
  // State for N-INSTANCE generation UI for each plan
  const [nInstanceGenStates, setNInstanceGenStates] = useState<Record<string, NInstanceGenerationState>>({});
  const [isSaving, setIsSaving] = useState(false);
  // State to track which popover is open EXPLICITLY - this helps control it
  const [openDatePopoverId, setOpenDatePopoverId] = useState<string | null>(null);

  useEffect(() => {
     setAvailablePlansMap(Object.fromEntries(availablePlans.map(p => [p.id, p])));
  }, [availablePlans]);

  // Initialize state when modal opens or patient/assignedPlans change
  useEffect(() => {
    if (isOpen && patient) {
        const initialAssigned: Record<string, AssignedPlan> = {};
        const initialNInstanceGen: Record<string, NInstanceGenerationState> = {};

        (patient.assignedPlans || []).forEach(plan => {
             const scheduledInstances = (plan.scheduledInstances || []).map(inst => ({
                 ...inst,
                 // Ensure date is a valid Date object, default to today if not
                  date: (inst.date instanceof Date && isValid(inst.date)) ? startOfDay(inst.date) : startOfDay(new Date())
             })).sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

             const defaultDuration = availablePlansMap[plan.planId]?.defaultDuration;
             const effectiveDuration = plan.customDuration && plan.customDuration > 0 ? plan.customDuration : defaultDuration;

            initialAssigned[plan.planId] = {
                ...plan,
                customDuration: effectiveDuration,
                scheduledInstances: scheduledInstances,
                totalInstancesRequired: plan.totalInstancesRequired,
            };
             // Initialize N-INSTANCE state for this plan
            initialNInstanceGen[plan.planId] = {
                startDate: undefined,
                selectedDaysOfWeek: [],
                time: undefined,
            };
        });
        setAssignedPlansMapState(initialAssigned);
        setNInstanceGenStates(initialNInstanceGen); // Initialize N instance states
        setOpenDatePopoverId(null); // Reset open popover state when modal opens
    } else {
         // Reset when closing
         setNInstanceGenStates({});
         setOpenDatePopoverId(null); // Reset open popover state
    }
  }, [isOpen, patient, patient.assignedPlans, availablePlansMap]);

  const handlePlanSelectionChange = (planId: string, checked: boolean | 'indeterminate') => {
    setAssignedPlansMapState(prev => {
      const updated = { ...prev };
      if (checked === true) {
        const planDetails = availablePlansMap[planId];
        updated[planId] = {
          planId: planId,
          customDuration: planDetails?.defaultDuration,
          scheduledInstances: [],
          totalInstancesRequired: undefined,
        };
          // Initialize N-Instance state when plan is selected
          setNInstanceGenStates(prevNInstance => ({
            ...prevNInstance,
            [planId]: {
                startDate: undefined,
                selectedDaysOfWeek: [],
                time: undefined,
            }
          }));
      } else {
        delete updated[planId];
         // Remove N-Instance state when plan is deselected
         setNInstanceGenStates(prevNInstance => {
             const updatedNInstance = { ...prevNInstance };
             delete updatedNInstance[planId];
             return updatedNInstance;
         });
      }
      return updated;
    });
     setOpenDatePopoverId(null); // Close any open popover when selection changes
  };


  const handleDurationChange = (planId: string, value: string) => {
    const duration = parseInt(value, 10);
    const defaultDuration = availablePlansMap[planId]?.defaultDuration;

    setAssignedPlansMapState(prev => {
         if (!prev[planId]) return prev;
         return {
            ...prev,
            [planId]: {
                ...prev[planId],
                // Set to undefined if empty, NaN, <= 0, or same as default
                customDuration: (!isNaN(duration) && duration > 0 && duration !== defaultDuration) ? duration : undefined
            }
         };
    });
  };

    const handleTotalInstancesChange = (planId: string, value: string) => {
        const total = parseInt(value, 10);
        setAssignedPlansMapState(prev => {
             if (!prev[planId]) return prev;
             const currentPlan = prev[planId]; // Get current plan data
             return {
                ...prev,
                [planId]: {
                    ...currentPlan,
                    // Set to undefined if empty, NaN, or <= 0
                    totalInstancesRequired: (!isNaN(total) && total > 0) ? total : undefined,
                }
             };
        });
    };


   const handleInstanceTimeChange = (planId: string, instanceIndex: number, time: string) => {
      setAssignedPlansMapState(prev => {
            const currentPlan = prev[planId];
            if (!currentPlan || !currentPlan.scheduledInstances) return prev;

            const updatedInstances = [...currentPlan.scheduledInstances];
            if (updatedInstances[instanceIndex]) {
                updatedInstances[instanceIndex] = {
                    ...updatedInstances[instanceIndex],
                    time: time || undefined // Ensure empty string becomes undefined
                };
            }
            return {
                ...prev,
                [planId]: {
                    ...currentPlan,
                    scheduledInstances: updatedInstances
                }
            };
        });
   }

   const handleInstanceDelete = (planId: string, instanceIndex: number) => {
      setAssignedPlansMapState(prev => {
            const currentPlan = prev[planId];
             if (!currentPlan || !currentPlan.scheduledInstances) return prev;
            const updatedInstances = [...currentPlan.scheduledInstances];
            updatedInstances.splice(instanceIndex, 1);
            return {
                ...prev,
                [planId]: {
                    ...currentPlan,
                    scheduledInstances: updatedInstances
                }
            };
        });
   }


    // --- N-Instance Generation ---
    const handleNInstanceStartDateChange = (planId: string, date: Date | undefined) => {
        setNInstanceGenStates(prev => ({
           ...prev,
           [planId]: { ...(prev[planId] || { selectedDaysOfWeek: [], time: undefined }), startDate: date ? startOfDay(date) : undefined } // Ensure startOfDay
         }));
         // Close the popover after selection
         setOpenDatePopoverId(null);
    };

    const handleNInstanceDayOfWeekToggle = (planId: string, dayIndex: number) => {
        setNInstanceGenStates(prev => {
            const currentState = prev[planId];
            if (!currentState) return prev; // Should exist if plan is selected

            const currentSelection = currentState.selectedDaysOfWeek || [];
            const newSelection = currentSelection.includes(dayIndex)
            ? currentSelection.filter(d => d !== dayIndex)
            : [...currentSelection, dayIndex];

            return {
            ...prev,
            [planId]: { ...currentState, selectedDaysOfWeek: newSelection.sort() }
            };
        });
    };

    const handleNInstanceTimeChange = (planId: string, value: string) => {
        const time = /^\d{2}:\d{2}$/.test(value) ? value : undefined;
        setNInstanceGenStates(prev => ({
            ...prev,
            [planId]: { ...(prev[planId] || { startDate: undefined, selectedDaysOfWeek: [] }), time: time }
        }));
    };

    const applyNInstanceGeneration = (planId: string) => {
        const nInstanceState = nInstanceGenStates[planId];
        const currentPlan = assignedPlansMapState[planId];
        if (!currentPlan) return;
        const totalRequired = currentPlan.totalInstancesRequired;

        if (!nInstanceState) return; // State should exist

        if (!totalRequired || totalRequired <= 0) {
            toast({ variant: "destructive", description: "Inserisci un 'Tot. Prest.' valido (> 0) prima di generare." });
            return;
        }
        if (!nInstanceState.startDate) {
            toast({ variant: "destructive", description: "Seleziona una data di inizio." });
            return;
        }
        if (nInstanceState.selectedDaysOfWeek.length === 0) {
            toast({ variant: "destructive", description: "Seleziona almeno un giorno della settimana." });
            return;
        }
        if (nInstanceState.time && !/^\d{2}:\d{2}$/.test(nInstanceState.time)) {
             toast({ variant: "destructive", description: "Inserisci un orario valido (HH:MM)." });
             return;
        }

        const generatedInstances = generateNInstancesOnDays(
            nInstanceState.startDate,
            totalRequired,
            nInstanceState.selectedDaysOfWeek,
            nInstanceState.time
        );

        if (generatedInstances.length !== totalRequired) {
            console.warn(`Generated ${generatedInstances.length} instances, but expected ${totalRequired}.`);
            toast({ variant: "destructive", title:"Errore Generazione", description: `Non è stato possibile generare esattamente ${totalRequired} date. Controlla i parametri.` });
            // Don't apply if generation failed partially
             return;
        }

        setAssignedPlansMapState(prev => {
            const currentPlan = prev[planId];
            if (!currentPlan) return prev;
            return {
                ...prev,
                [planId]: {
                    ...currentPlan,
                    scheduledInstances: generatedInstances,
                    // Keep totalInstancesRequired as it was the input
                }
            };
        });

        toast({ title: "Date Generate (N Prestazioni)", description: `${generatedInstances.length} date generate e applicate per ${availablePlansMap[planId]?.name}.` });
    };


  const handleSaveClick = async () => {
      setIsSaving(true);
      try {
          const plansToSaveArray = Object.values(assignedPlansMapState);
          // Validation: Check for valid duration
          const invalidDurationPlan = plansToSaveArray.find(p => {
              const defaultDuration = availablePlansMap[p.planId]?.defaultDuration;
              const effectiveDuration = p.customDuration !== undefined ? p.customDuration : defaultDuration;
              return effectiveDuration === undefined || effectiveDuration <= 0;
          });

          if (invalidDurationPlan) {
              const planName = availablePlansMap[invalidDurationPlan.planId]?.name || `ID: ${invalidDurationPlan.planId}`;
              toast({ variant: "destructive", title: "Errore Validazione", description: `Il piano "${planName}" ha una durata non valida o mancante.` });
              setIsSaving(false);
              return;
          }

           // Validation: Check instance times format
           let invalidTimeFound = false;
           plansToSaveArray.forEach(p => {
                (p.scheduledInstances || []).forEach(inst => {
                    if (inst.time && !/^\d{2}:\d{2}$/.test(inst.time)) {
                        const planName = availablePlansMap[p.planId]?.name || `ID: ${p.planId}`;
                        const dateStr = inst.date ? format(inst.date, 'dd/MM/yy', { locale: it }) : 'data invalida';
                         toast({ variant: "destructive", title: "Errore Validazione", description: `Formato orario non valido (${inst.time}) per ${planName} il ${dateStr}. Usare HH:MM.` });
                        invalidTimeFound = true;
                    }
                    // Also ensure date is valid
                    if (!inst.date || !(inst.date instanceof Date) || !isValid(inst.date)) {
                         const planName = availablePlansMap[p.planId]?.name || `ID: ${p.planId}`;
                         toast({ variant: "destructive", title: "Errore Validazione", description: `Data non valida per ${planName}.` });
                         invalidTimeFound = true; // Use same flag
                    }
                });
           });
           if (invalidTimeFound) {
                setIsSaving(false);
                return;
           }

            // --- All Validations Passed ---
            await onSave(patient.id, plansToSaveArray); // Await the save operation
            // onSave should handle closing the modal on success/failure

      } catch (e) {
          console.error("Error during save validation:", e);
          toast({ variant: "destructive", title: "Errore", description: "Si è verificato un errore imprevisto durante il salvataggio." });
           setIsSaving(false); // Ensure loading state is reset on unexpected error
      } finally {
          // Only set saving to false if an error occurred *before* calling onSave or if onSave itself failed
           // setIsSaving(false); // Let the calling component manage this based on onSave result
      }
  };

   const getDurationInputValue = (planId: string): string => {
     const assignment = assignedPlansMapState[planId];
     // Return the customDuration if it exists (and is not undefined), otherwise empty string
     return assignment?.customDuration?.toString() ?? '';
   };

     const getTotalInstancesInputValue = (planId: string): string => {
        const assignment = assignedPlansMapState[planId];
        // Return the totalInstancesRequired if it exists (and is not undefined), otherwise empty string
        return assignment?.totalInstancesRequired?.toString() ?? '';
     };


  return (
    // Set `modal={false}` on Dialog to allow interaction with Popover (Needed for mobile)
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setOpenDatePopoverId(null); }}} modal={false}>
      <DialogContent className="sm:max-w-[95vw] md:max-w-[800px] lg:max-w-[900px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Gestisci Piani per {patient.name}</DialogTitle>
          <DialogDescription>
              Seleziona prestazioni, configura opzioni e genera le date di esecuzione.
          </DialogDescription>
        </DialogHeader>

        {/* Use ScrollArea for the main content */}
        <ScrollArea className="flex-grow overflow-y-auto px-6 pt-4">
            <div className="grid gap-10 pb-6">
            {availablePlans.map((plan) => {
              const isSelected = !!assignedPlansMapState[plan.id];
              const currentAssignment = assignedPlansMapState[plan.id];
              const nInstanceState = nInstanceGenStates[plan.id]; // Get N-INSTANCE state
              const defaultDuration = plan.defaultDuration;
              const popoverId = `popover-date-${plan.id}`; // Unique ID for this popover instance

              return (
                <div key={plan.id} className="grid gap-4 border-b pb-8 last:border-b-0">
                   {/* Plan Selection and Basic Config */}
                   <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4">
                     <div className="flex items-start space-x-2 mt-1 sm:mt-0 shrink-0">
                       <Checkbox
                          id={`plan-${plan.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handlePlanSelectionChange(plan.id, checked)}
                          aria-label={`Seleziona piano ${plan.name}`}
                          className="mt-1"
                        />
                       <Label htmlFor={`plan-${plan.id}`} className="text-base font-medium cursor-pointer flex-grow">
                          {plan.name}
                          {plan.description && <span className="block text-xs text-muted-foreground font-normal mt-0.5">{plan.description}</span>}
                        </Label>
                     </div>
                     <div className="flex-grow min-w-0"></div> {/* Spacer */}
                      {isSelected && (
                         <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-start sm:justify-end w-full sm:w-auto">
                             {/* Total Instances Input - Responsive Width */}
                             <div className="flex-1 min-w-[100px] sm:min-w-[120px] sm:w-auto">
                                 <Label htmlFor={`totalInstances-${plan.id}`} className="flex items-center gap-1 text-xs sm:text-sm mb-1">
                                    <Sigma className="w-3 h-3" /> Tot. Prest.
                                 </Label>
                                 <Input
                                     id={`totalInstances-${plan.id}`} type="number" min="1" placeholder="Es. 10"
                                     value={getTotalInstancesInputValue(plan.id)}
                                     onChange={(e) => handleTotalInstancesChange(plan.id, e.target.value)}
                                     className="h-9 text-sm"
                                 />
                             </div>
                             {/* Duration Input - Responsive Width */}
                             <div className="flex-1 min-w-[100px] sm:min-w-[120px] sm:w-auto">
                                 <Label htmlFor={`duration-${plan.id}`} className="flex items-center gap-1 text-xs sm:text-sm mb-1">
                                     <Clock className="w-3 h-3" /> Durata (min)
                                 </Label>
                                 <Input
                                     id={`duration-${plan.id}`} type="number" min="1" placeholder={`Std: ${defaultDuration}`}
                                     value={getDurationInputValue(plan.id)}
                                     onChange={(e) => handleDurationChange(plan.id, e.target.value)}
                                     className="h-9 text-sm"
                                 />
                             </div>
                         </div>
                      )}
                   </div>

                   {/* Show scheduling options only if selected */}
                   {isSelected && currentAssignment && nInstanceState && (
                     // Adjusted grid columns for two sections
                     <div className="pl-8 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6 border-t pt-6">
                       {/* --- Column 1: Generate N Instances --- */}
                       <div className="space-y-6 border-r-0 lg:border-r lg:pr-6">

                          {/* Section: Generate N Instances */}
                          <div className="space-y-4">
                              <Label className="block text-sm font-medium flex items-center gap-1.5"><Bot className="w-4 h-4"/> Genera Prestazioni</Label>
                              <p className="text-xs text-muted-foreground">Genera un numero specifico di date, a partire da una data, su giorni selezionati.</p>
                               <div>
                                   <Label className="text-xs text-muted-foreground mb-1.5 block">Data di Inizio</Label>
                                    {/* Use Popover with explicit open control */}
                                    <Popover
                                        key={popoverId}
                                        open={openDatePopoverId === popoverId}
                                        onOpenChange={(isOpen) => setOpenDatePopoverId(isOpen ? popoverId : null)}
                                        // Ensure modal={false} is not blocking interactions within Popover
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal gap-2 h-9 text-sm",
                                                    !nInstanceState.startDate && "text-muted-foreground"
                                                )}
                                                // onClick ensures the popover opens even if already controlled
                                                onClick={() => setOpenDatePopoverId(popoverId)}
                                            >
                                                <CalendarIcon className="w-4 h-4" />
                                                {nInstanceState.startDate ? format(nInstanceState.startDate, "dd MMM yy", { locale: it }) : <span>Scegli data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        {/* Ensure PopoverContent has a high z-index and works on mobile */}
                                        <PopoverContent
                                            className="w-auto p-0 z-[5000]"
                                            align="start"
                                            // Avoid closing when interacting inside the calendar
                                            onInteractOutside={(e) => {
                                                 // Prevent closing if clicking inside the popover itself
                                                 // This might be needed on some mobile browsers
                                                // e.preventDefault();
                                            }}
                                        >
                                            <ShadCalendar
                                                mode="single"
                                                selected={nInstanceState.startDate}
                                                onSelect={(date) => handleNInstanceStartDateChange(plan.id, date)}
                                                initialFocus
                                                locale={it}
                                                disabled={(date) => date < startOfDay(new Date())}
                                                numberOfMonths={1}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                     <Label className="text-xs text-muted-foreground mb-1.5 block">Giorni della Settimana</Label>
                                     <div className="flex flex-wrap gap-2">
                                        {[1, 2, 3, 4, 5, 6, 0].map(dayIndex => (
                                            <Button
                                                key={`n-${dayIndex}`}
                                                variant={nInstanceState.selectedDaysOfWeek.includes(dayIndex) ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handleNInstanceDayOfWeekToggle(plan.id, dayIndex)}
                                                className="h-7 px-2.5 text-xs"
                                            >
                                                {daysOfWeekMap[dayIndex]}
                                            </Button>
                                        ))}
                                     </div>
                                 </div>
                                 <div>
                                     <Label htmlFor={`nInstanceTime-${plan.id}`} className="text-xs text-muted-foreground mb-1.5 block">Orario Unico (Opzionale)</Label>
                                     <Input
                                        id={`nInstanceTime-${plan.id}`} type="time"
                                        value={nInstanceState.time || ''}
                                        onChange={(e) => handleNInstanceTimeChange(plan.id, e.target.value)}
                                        className="h-9 text-sm"
                                        placeholder="HH:MM"
                                    />
                                 </div>
                                 <Button onClick={() => applyNInstanceGeneration(plan.id)} size="sm" className="w-full gap-1.5">
                                    <ChevronsRight className="w-4 h-4" />
                                    Genera e Applica
                                </Button>
                          </div>


                       </div>

                       {/* Column 2: Instance List */}
                       <div className="space-y-4">
                          <Label className="block text-sm font-medium">Date e Orari Pianificati ({currentAssignment.scheduledInstances?.length || 0})</Label>
                          {currentAssignment.scheduledInstances && currentAssignment.scheduledInstances.length > 0 ? (
                              <ScrollArea className="h-60 border rounded-md p-2 bg-muted/20">
                                 <div className="space-y-2">
                                     {currentAssignment.scheduledInstances.map((instance, index) => (
                                         <div key={`${plan.id}-instance-${index}`} className="flex items-center justify-between gap-2 text-sm bg-background p-2 rounded shadow-sm">
                                              {/* Display Date */}
                                              <span className="font-medium min-w-[70px]">
                                                  {(instance.date instanceof Date && isValid(instance.date))
                                                    ? format(instance.date, 'dd MMM yy', { locale: it })
                                                    : <span className='text-destructive'>Data Invalida</span>
                                                  }
                                              </span>
                                               {/* Time Input and Delete Button */}
                                               <div className="flex items-center gap-1">
                                                   <Label htmlFor={`time-${plan.id}-${index}`} className="sr-only">Orario</Label>
                                                   <Input
                                                        id={`time-${plan.id}-${index}`} type="time"
                                                        value={instance.time || ''}
                                                        onChange={(e) => handleInstanceTimeChange(plan.id, index, e.target.value)}
                                                        className="h-7 w-[80px] text-xs px-1.5"
                                                        placeholder="HH:MM"
                                                    />
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleInstanceDelete(plan.id, index)} title="Rimuovi data">
                                                         <Trash2 className="w-3.5 h-3.5" />
                                                     </Button>
                                               </div>
                                         </div>
                                     ))}
                                 </div>
                              </ScrollArea>
                          ) : (
                             <div className="text-sm text-muted-foreground text-center border rounded-md p-4 h-60 flex items-center justify-center bg-muted/20">
                                Nessuna data pianificata. Usa il generatore o aggiungile manualmente.
                             </div>
                          )}
                           {/* Manual Mode Info */}
                            <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/30 flex items-start gap-2">
                                <Info className="w-3 h-3 mt-0.5 shrink-0"/>
                                <span>
                                    Le date/orari pianificati possono essere aggiunti/modificati manualmente in questa sezione. Usa il generatore (sopra) per popolarla automaticamente.
                                </span>
                            </div>
                             {/* TODO: Add manual date adding functionality if needed */}
                       </div>
                     </div>
                   )}
                </div>
              );
            })}
            {availablePlans.length === 0 && (
                <p className="text-muted-foreground text-center col-span-full py-10">
                    Nessun tipo di prestazione disponibile. Aggiungine uno nella sezione 'Aggiungi'.
                </p>
            )}
          </div>
        </ScrollArea>

        {/* Use the correct DialogFooter component */}
        <DialogFooter className="mt-auto px-6 pb-6 pt-4 border-t">
           <DialogClose asChild>
             <Button type="button" variant="outline" disabled={isSaving}>Annulla</Button>
           </DialogClose>
           <Button type="button" onClick={handleSaveClick} disabled={!patient || isSaving}>
             {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvataggio...</> : 'Salva Piani'}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PatientPlanModal;

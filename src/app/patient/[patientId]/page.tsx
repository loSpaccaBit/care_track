
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select
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
} from "@/components/ui/alert-dialog"; // Import Alert Dialog components
import { User, Building, Clock, Calendar, ClipboardList, PlusCircle, ArrowLeft, Edit, ListChecks, Info, CheckSquare, Timer, Loader2, Trash2, Sigma, Save, XCircle, Phone } from 'lucide-react'; // Added Save, XCircle, Phone
import { format, parseISO, startOfDay, isValid } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import type { Patient, Service, Company, Plan, AssignedPlan, ScheduledInstance } from '@/lib/types';
// Updated imports to use Firestore utils
import {
  getPatient,
  getServicesByPatient,
  addService,
  getCompany,
  getAllCompanies, // Fetch all companies for edit dropdown
  getAssignedPlansForPatient,
  getAllPlans,
  getPlan,
  updatePatientAssignedPlans,
  deletePatient, // Import deletePatient
  updateData, // Import updateData for saving edits
} from '@/lib/firebase/firestore-utils';
import PatientPlanModal from '@/app/patients/_components/patient-plan-modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { cn, normalizePhoneNumber } from '@/lib/utils'; // Import cn and normalizePhoneNumber

// --- Skeleton Components ---
// (Keep Skeleton components as they are)
const PatientDetailSkeleton: FC = () => (
  <Card className="bg-card border border-border rounded-lg shadow-sm">
    <CardHeader className="bg-accent/10 border-b border-border p-4 flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-6 w-3/5 rounded" />
      </div>
      <Skeleton className="w-8 h-8 rounded bg-muted" /> {/* Skeleton for Edit button */}
    </CardHeader>
    <CardContent className="p-4 grid gap-3 text-sm">
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>
    </CardContent>
  </Card>
);

const AssignedPlanSkeleton: FC = () => (
  <div className="border rounded-md p-3 bg-muted/30">
    <div className="flex justify-between items-start mb-2 border-b pb-2">
      <Skeleton className="h-5 w-1/2 rounded" />
      <Skeleton className="h-5 w-16 rounded" />
    </div>
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </div>
  </div>
);

const ServiceListItemSkeleton: FC = () => (
  <li className="p-4 grid gap-1 border-b">
    <div className="flex justify-between items-center text-sm font-medium">
      <Skeleton className="h-4 w-1/3 rounded" />
      <Skeleton className="h-4 w-1/2 rounded" />
    </div>
    <Skeleton className="h-4 w-full rounded mt-1" />
  </li>
);

const ServicesListSkeleton: FC = () => (
  <Card className="bg-card border border-border rounded-lg shadow-sm">
    <CardHeader className="bg-accent/10 border-b border-border p-4 flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-6 w-40 rounded" />
      </div>
      <Skeleton className="h-8 w-24 rounded" />
    </CardHeader>
    <CardContent className="p-0">
      <ul className="divide-y divide-border">
        <ServiceListItemSkeleton />
        <ServiceListItemSkeleton />
        <ServiceListItemSkeleton />
      </ul>
    </CardContent>
    <CardFooter className="p-4 bg-accent/10 border-t border-border mt-auto flex flex-col items-start">
      <Skeleton className="h-5 w-48 mb-2 rounded" />
      <Skeleton className="h-4 w-40 rounded" />
    </CardFooter>
  </Card>
);
// --- End Skeleton Components ---


const PatientProfilePage: FC = () => {
  const { loading: authLoading, user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const patientId = params.patientId as string;
  const { toast } = useToast();

  // Patient state now includes assignedPlans directly
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]); // State for all companies (for edit dropdown)
  const [services, setServices] = useState<Service[]>([]);
  const [allAvailablePlans, setAllAvailablePlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [newService, setNewService] = useState<{ date: Date; startTime: string; endTime: string; description: string }>({
    date: startOfDay(new Date()),
    startTime: '',
    endTime: '',
    description: ''
  });
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [plansMap, setPlansMap] = useState<Record<string, Plan>>({});
  const [isClientReady, setIsClientReady] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog
  const [isDeleting, setIsDeleting] = useState(false); // State for deletion loading

  // --- Edit State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editingPatientData, setEditingPatientData] = useState<Partial<Patient>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // --- End Edit State ---

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      if (!user || authLoading || !patientId || !isClientReady) {
        setIsLoading(authLoading || !isClientReady);
        return;
      }
      setIsLoading(true);
      setPatient(undefined); // Reset patient state while loading
      try {
        // Fetch all data concurrently
        const [fetchedPatientData, fetchedServices, fetchedAssignedPlansData, availablePlans, fetchedAllCompanies] = await Promise.all([
          getPatient(patientId),
          getServicesByPatient(patientId),
          getAssignedPlansForPatient(patientId),
          getAllPlans(),
          getAllCompanies(), // Fetch all companies for the edit dropdown
        ]);

        setAllCompanies(fetchedAllCompanies); // Store all companies

        if (fetchedPatientData) {
          // Combine fetched patient data with their assigned plans
          const patientWithPlans: Patient = {
            ...fetchedPatientData,
            assignedPlans: fetchedAssignedPlansData || [] // Ensure assignedPlans is always an array
          };
          setPatient(patientWithPlans); // Set the complete patient object
          setEditingPatientData(patientWithPlans); // Initialize edit form data
          setServices(fetchedServices);
          setAllAvailablePlans(availablePlans);
          setPlansMap(Object.fromEntries(availablePlans.map(p => [p.id, p])));

          // Use the already fetched allCompanies list to find the current company
          const currentCompany = fetchedAllCompanies.find(c => c.id === fetchedPatientData.companyId);
          setCompany(currentCompany || null);
        } else {
          setPatient(null);
          toast({ variant: "destructive", title: "Errore", description: "Paziente non trovato." });
        }
      } catch (error) {
        console.error("Error fetching patient data:", error);
        toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare i dati del paziente." });
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [patientId, user, authLoading, isClientReady, toast]);

  // Redirect to login if auth is resolved, user is null, and client is ready
  useEffect(() => {
    if (isClientReady && !authLoading && !user) {
      console.log('PatientProfilePage: No user found after loading, redirecting to login.');
      router.replace(`/login?redirect=/patient/${patientId}`);
    }
  }, [isClientReady, authLoading, user, router, patientId]);


  // --- Event Handlers ---
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.date || !newService.startTime || !newService.endTime || !newService.description) {
      toast({ variant: "destructive", title: "Errore", description: "Compila tutti i campi della prestazione." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Errore", description: "Autenticazione richiesta." });
      return;
    }
    setIsAddingService(true);
    try {
      const serviceToAdd = await addService({
        patientId: patientId,
        date: newService.date,
        startTime: newService.startTime,
        endTime: newService.endTime,
        description: newService.description,
        userId: user.uid,
      });

      setServices(prevServices => [serviceToAdd, ...prevServices].sort((a, b) => {
        const dateA = a.date;
        const dateB = b.date;
        if (dateB.getTime() !== dateA.getTime()) return dateB.getTime() - dateA.getTime();
        return (a.startTime || 'N/D').localeCompare(b.startTime || 'N/D');
      }));
      setShowAddServiceForm(false);
      setNewService({ date: startOfDay(new Date()), startTime: '', endTime: '', description: '' });

      toast({
        title: "Successo",
        description: "Prestazione aggiunta correttamente.",
      });
      // Refresh patient data to update remaining instances count
      const refreshedPatientData = await getPatient(patientId);
      if (refreshedPatientData) {
        const patientWithPlans: Patient = {
          ...refreshedPatientData,
          assignedPlans: (await getAssignedPlansForPatient(patientId)) || []
        };
        setPatient(patientWithPlans);
        setEditingPatientData(patientWithPlans); // Update edit data as well
      }
    } catch (error) {
      console.error("Error adding service:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile aggiungere la prestazione.",
      });
    } finally {
      setIsAddingService(false);
    }
  };

  const handleSavePlans = async (patientId: string, plansToSave: AssignedPlan[]) => {
    if (!user) {
      toast({ variant: "destructive", title: "Errore", description: "Autenticazione richiesta." });
      return;
    }
    console.log(`Saving plans for patient ${patientId}:`, plansToSave);
    toast({ title: "Salvataggio piani...", description: "Attendere prego..." });
    try {
      await updatePatientAssignedPlans(patientId, plansToSave);
      // Update the patient state directly with the saved plans
      setPatient(prevPatient => {
        if (!prevPatient) return null; // Should not happen if modal is open
        const updatedPatient = {
          ...prevPatient,
          assignedPlans: plansToSave.map(ap => ({ // Update local state
            ...ap,
            scheduledInstances: ap.scheduledInstances?.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
          }))
        };
        setEditingPatientData(updatedPatient); // Update edit state too
        return updatedPatient;
      });
      toast({
        title: "Piani Salvati",
        description: `Configurazione piani salvata per ${patient?.name}.`,
      });
    } catch (error) {
      console.error("Error saving plans:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile salvare i piani.",
      });
    } finally {
      setIsPlanModalOpen(false);
    }
  };

  // Handle Delete Patient
  const handleDeletePatient = async () => {
    if (!patientId || !user) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile eliminare il paziente.' });
      return;
    }
    setIsDeleting(true);
    try {
      await deletePatient(patientId);
      toast({ title: 'Successo', description: `Paziente ${patient?.name || ''} eliminato.` });
      setIsDeleteDialogOpen(false);
      router.push('/patients'); // Redirect to patients list
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast({
        variant: 'destructive',
        title: 'Errore Eliminazione',
        description: error instanceof Error ? error.message : 'Impossibile eliminare il paziente.',
      });
      setIsDeleting(false);
    }
    // No need to set isDeleting to false on success due to redirect
  };

  // --- Edit Handlers ---
  const handleEditToggle = () => {
    if (isEditing) {
      // If cancelling edit, reset edit data to original patient data
      if (patient) {
        setEditingPatientData(patient);
      }
    }
    setIsEditing(!isEditing);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingPatientData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditCompanyChange = (value: string) => {
    setEditingPatientData(prev => ({ ...prev, companyId: value }));
  };

  const handleSaveEdit = async () => {
    if (!patient || !editingPatientData || !user) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Dati paziente mancanti.' });
      return;
    }

    // Validate required fields
    if (!editingPatientData.name || !editingPatientData.companyId || !editingPatientData.address || !editingPatientData.contact) {
      toast({ variant: 'destructive', title: 'Errore Validazione', description: 'Compila tutti i campi obbligatori.' });
      return;
    }

    setIsSavingEdit(true);
    try {
      // Normalize phone number before saving
      const normalizedContact = normalizePhoneNumber(editingPatientData.contact);
      const dataToUpdate: Partial<Patient> = {
        name: editingPatientData.name,
        companyId: editingPatientData.companyId,
        address: editingPatientData.address,
        contact: normalizedContact,
      };

      // Update Firestore document
      await updateData<Patient>('patients', patient.id, dataToUpdate);

      // Update local state for patient and company
      setPatient(prev => prev ? { ...prev, ...dataToUpdate } : null);
      const updatedCompany = allCompanies.find(c => c.id === dataToUpdate.companyId);
      setCompany(updatedCompany || null);
      setIsEditing(false); // Exit edit mode

      toast({ title: 'Successo', description: 'Dati paziente aggiornati.' });
    } catch (error) {
      console.error('Error saving patient edits:', error);
      toast({
        variant: 'destructive',
        title: 'Errore Salvataggio',
        description: error instanceof Error ? error.message : 'Impossibile salvare le modifiche.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };
  // --- End Edit Handlers ---


  // --- Calculations & Helpers ---
  const totalMinutesPerCompany = useMemo(() => {
    return services.reduce((acc, service) => {
      const companyName = company?.name || 'Azienda Sconosciuta';
      acc[companyName] = (acc[companyName] || 0) + (service.durationMinutes || 0); // Handle potentially undefined duration
      return acc;
    }, {} as Record<string, number>);
  }, [services, company]);

  const getPlanName = (planId: string): string => {
    return plansMap[planId]?.name || 'Piano Sconosciuto';
  }

  const getPlanDescription = (planId: string): string | undefined => {
    return plansMap[planId]?.description;
  }

  const getPlanDefaultDuration = (planId: string): number | undefined => {
    return plansMap[planId]?.defaultDuration;
  }

  // Calculate remaining instances for a plan
  const getRemainingInstances = (assignedPlan: AssignedPlan): number | null => {
    if (assignedPlan.totalInstancesRequired === undefined || assignedPlan.totalInstancesRequired <= 0) {
      return null; // Not tracking total required or invalid total
    }
    // Count services that likely correspond to this plan
    const servicesForPlan = services.filter(s =>
      s.patientId === patientId &&
      s.description?.includes(getPlanName(assignedPlan.planId))
    ).length;

    // Remaining = Total Required - Completed Services
    const remaining = assignedPlan.totalInstancesRequired - servicesForPlan;

    return Math.max(0, remaining); // Ensure remaining is not negative
  };


  // Loading state: covers auth loading, client not ready, or data fetching
  // Check patient === undefined to distinguish initial loading from patient not found (null)
  if (authLoading || isLoading || !isClientReady || patient === undefined) {
    return (
      <>
        <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
          <Skeleton className="h-8 w-20 rounded bg-primary/80" />
          <Skeleton className="h-7 w-32 rounded bg-primary/80 mx-auto" />
          <div className="w-20"></div>
        </header>
        <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">
          <PatientDetailSkeleton />
          <Card className="bg-card border border-border rounded-lg shadow-sm">
            <CardHeader className="bg-accent/10 border-b border-border p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
              <Skeleton className="h-8 w-24 rounded" />
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <AssignedPlanSkeleton />
              <AssignedPlanSkeleton />
            </CardContent>
          </Card>
          <ServicesListSkeleton />
          {/* Skeleton for Delete Card */}
          <Card className="bg-card border border-border rounded-lg shadow-sm">
            <CardHeader className="p-4">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-4 w-full mt-2 rounded" />
            </CardHeader>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-full rounded" />
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (!user && isClientReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (patient === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
        <Button variant="ghost" onClick={() => router.push('/patients')} className="absolute top-4 left-4 flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="w-5 h-5" /> Torna ai Pazienti
        </Button>
        <p className="text-destructive text-xl">Paziente non trovato.</p>
        <Button onClick={() => router.back()} className="mt-4">Indietro</Button>
      </div>
    );
  }

  if (!user) {
    console.error("PatientProfilePage: Render reached with null user despite checks.");
    return null;
  }


  // --- Render actual content when data is loaded and user is authenticated ---
  const currentAssignedPlans = patient?.assignedPlans || []; // Use plans from patient state

  return (
    <>
      <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-1 text-primary-foreground hover:bg-primary/80 px-2">
          <ArrowLeft className="w-5 h-5" /> Indietro
        </Button>
        <h1 className="text-xl font-bold text-center flex-grow mr-12">{patient.name}</h1>
      </header>

      <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24"> {/* Added pb-24 */}
        {/* Patient Details Card */}
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="bg-accent/10 border-b border-border p-4 flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
              <User className="w-6 h-6" />
              Informazioni Paziente
            </CardTitle>
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleEditToggle} className="gap-1" disabled={isSavingEdit}>
                  <XCircle className="w-4 h-4" /> Annulla
                </Button>
                <Button size="sm" onClick={handleSaveEdit} className="gap-1" disabled={isSavingEdit}>
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salva
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleEditToggle} className="gap-1">
                <Edit className="w-4 h-4" /> Modifica
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 grid gap-4 text-sm">
            {isEditing ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-name">Nome Paziente</Label>
                  <Input id="edit-name" name="name" value={editingPatientData.name || ''} onChange={handleEditInputChange} disabled={isSavingEdit} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-company">Azienda</Label>
                  <Select name="companyId" value={editingPatientData.companyId || ''} onValueChange={handleEditCompanyChange} disabled={isSavingEdit}>
                    <SelectTrigger id="edit-company">
                      <SelectValue placeholder="Seleziona azienda" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-address">Indirizzo</Label>
                  <Input id="edit-address" name="address" value={editingPatientData.address || ''} onChange={handleEditInputChange} disabled={isSavingEdit} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact">Contatto Telefonico</Label>
                  <Input id="edit-contact" name="contact" type="tel" value={editingPatientData.contact || ''} onChange={handleEditInputChange} disabled={isSavingEdit} placeholder="es. 3331234567" />
                  <p className="text-xs text-muted-foreground mt-1">Verrà normalizzato (es. +393331234567 diventerà 3331234567).</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-accent" />
                  <span className="font-medium">Azienda:</span> {company?.name || 'Non specificata'}
                </div>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">Indirizzo:</span> {patient.address}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-accent" />
                  <span className="font-medium">Contatto:</span>
                  <a href={`tel:${patient.contact.replace(/\s/g, '')}`} className="text-primary hover:underline">
                    {patient.contact}
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Assigned Plans Card */}
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="bg-accent/10 border-b border-border p-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-primary" />
              <CardTitle className="text-xl font-semibold text-primary">Piani Assegnati</CardTitle>
            </div>
            <Button size="sm" onClick={() => setIsPlanModalOpen(true)} variant="outline" className="gap-1" disabled={isEditing}>
              <Edit className="w-4 h-4" />
              Gestisci
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {currentAssignedPlans.length > 0 ? (
              <div className="space-y-4">
                {currentAssignedPlans.map((assignedPlan) => {
                  const remainingInstances = getRemainingInstances(assignedPlan);
                  const isLowOnInstances = remainingInstances !== null && remainingInstances < 3;
                  const planDetails = plansMap[assignedPlan.planId]; // Get full plan details
                  const effectiveDuration = assignedPlan.customDuration ?? planDetails?.defaultDuration;

                  return (
                    <div key={assignedPlan.planId} className="border rounded-md p-3 bg-background">
                      <div className="flex justify-between items-start mb-2 border-b pb-2 gap-2">
                        <div className="flex-grow">
                          <span className="font-medium text-primary flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-accent" />
                            {planDetails?.name || 'Piano Sconosciuto'}
                          </span>
                          {planDetails?.description && (
                            <p className="text-xs text-muted-foreground mt-1 pl-6">{planDetails.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-1 shrink-0">
                          <Badge variant="secondary" className="whitespace-nowrap">
                            <Clock className="w-3 h-3 mr-1" />
                            {effectiveDuration ? `${effectiveDuration} min` : 'Durata N/D'}
                          </Badge>
                          <div className='flex flex-col'>
                            <span>
                              <p className='text-sm'>
                                Valido fino al: <span className='text-primary font-bold'>
                                  {assignedPlan.scheduledInstances && assignedPlan.scheduledInstances.length > 0
                                    ? format(assignedPlan.scheduledInstances[assignedPlan.scheduledInstances.length - 1].date, 'dd/MM/yy', { locale: it })
                                    : 'N/D'
                                  }
                                </span>

                              </p>
                            </span>

                            <span>
                              {remainingInstances !== null && (
                                <Badge variant={isLowOnInstances ? "destructive" : "outline"} className={cn("whitespace-nowrap", isLowOnInstances ? 'animate-pulse' : '')}>
                                  <Sigma className="w-3 h-3 mr-1" />
                                  Prest. Rimanenti: {remainingInstances} / {assignedPlan.totalInstancesRequired}
                                </Badge>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {assignedPlan.scheduledInstances && assignedPlan.scheduledInstances.length > 0 ? (
                        <div>
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-1">
                            <Calendar className="w-4 h-4" /> Prossime Esecuzioni:
                          </span>
                          <ScrollArea className="max-h-40 pr-2">
                            <ul className="space-y-1.5">
                              {assignedPlan.scheduledInstances.map((instance, index) => (
                                <li key={`${assignedPlan.planId}-${index}`} className="flex justify-between items-center text-xs border-l-2 border-accent pl-2 py-0.5">
                                  <span>{instance.date instanceof Date ? format(instance.date, 'EEE dd/MM/yy', { locale: it }) : 'Data invalida'}</span>
                                  {instance.time ? (
                                    <Badge variant="outline" className="flex items-center gap-1">
                                      <Timer className="w-3 h-3" /> {instance.time}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">Orario N/D</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </ScrollArea>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic mt-2 pl-6">Nessuna data specifica pianificata. Gestisci per aggiungere date.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Nessun piano assegnato a questo paziente.</p>
            )}
          </CardContent>
        </Card>


        {/* Service Tracking Card */}
        <Card className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="bg-accent/10 border-b border-border p-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              <CardTitle className="text-xl font-semibold text-primary">Prestazioni Erogate</CardTitle>
            </div>
            <Button size="sm" onClick={() => setShowAddServiceForm(!showAddServiceForm)} variant="outline" className="gap-1" disabled={isAddingService || isEditing}>
              {showAddServiceForm ? 'Annulla' : <><PlusCircle className="w-4 h-4" /> Aggiungi</>}
            </Button>
          </CardHeader>

          {showAddServiceForm && (
            <CardContent className="p-4 border-b border-border">
              <form onSubmit={handleAddService} className="grid gap-4">
                <div>
                  <Label htmlFor="serviceDate">Data</Label>
                  <Input
                    type="date" id="serviceDate" required
                    value={format(newService.date, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const dateValue = e.target.value ? startOfDay(new Date(e.target.value + 'T00:00:00')) : startOfDay(new Date());
                      setNewService({ ...newService, date: dateValue });
                    }}
                    className="mt-1"
                    disabled={isAddingService}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Ora Inizio</Label>
                    <Input
                      type="time" id="startTime" required
                      value={newService.startTime}
                      onChange={(e) => setNewService({ ...newService, startTime: e.target.value })}
                      className="mt-1"
                      disabled={isAddingService}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">Ora Fine</Label>
                    <Input
                      type="time" id="endTime" required
                      value={newService.endTime}
                      onChange={(e) => setNewService({ ...newService, endTime: e.target.value })}
                      className="mt-1"
                      disabled={isAddingService}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Descrizione Prestazione</Label>
                  <Textarea
                    id="description" required
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    placeholder="Descrivi la prestazione eseguita..."
                    className="mt-1"
                    rows={3}
                    disabled={isAddingService}
                  />
                </div>
                <Button type="submit" className="w-full md:w-auto justify-self-end gap-2" disabled={isAddingService}>
                  {isAddingService ? <><Loader2 className="animate-spin w-4 h-4" /> Salvataggio...</> : <><PlusCircle className="w-4 h-4" /> Salva Prestazione</>}
                </Button>
              </form>
            </CardContent>
          )}

          <CardContent className="p-0">
            {services.length > 0 ? (
              <ScrollArea className="max-h-96">
                <ul className="divide-y divide-border">
                  {services.map((service) => (
                    <li key={service.id} className="p-4 grid gap-1 hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-accent" />
                          {service.date instanceof Date ? format(service.date, 'dd/MM/yyyy', { locale: it }) : 'Data invalida'}
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4 text-accent" />
                          {service.startTime || 'N/D'} - {service.endTime || 'N/D'} ({service.durationMinutes ?? '?'} min)
                        </span>
                      </div>
                      <p className="text-sm text-foreground pl-5">{service.description}</p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground p-4">Nessuna prestazione registrata.</p>
            )}
          </CardContent>
          <CardFooter className="p-4 bg-accent/10 border-t border-border mt-auto flex flex-col items-start">
            <h3 className="text-md font-semibold text-primary mb-2">Riepilogo Ore ({company?.name || 'Azienda Sconosciuta'})</h3>
            {Object.entries(totalMinutesPerCompany).length > 0 ? (
              Object.entries(totalMinutesPerCompany).map(([companyName, minutes]) => (
                <div key={companyName} className="text-sm mt-1 w-full">
                  <span className="font-medium">{Math.floor(minutes / 60)} ore e {minutes % 60} minuti</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Nessuna prestazione registrata per calcolare le ore.</p>
            )}
          </CardFooter>
        </Card>

        {/* Delete Patient Card - Added */}
        <Card className="bg-card border border-destructive rounded-lg shadow-sm">
          <CardHeader className="p-4">
            <CardTitle className="text-xl font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              Elimina Paziente
            </CardTitle>
            <CardDescription className="text-sm text-destructive/80 pt-1">
              Questa azione è irreversibile e eliminerà tutti i dati associati a questo paziente, inclusi i piani assegnati. Le prestazioni già erogate rimarranno registrate nello storico generale.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2" disabled={isDeleting || isEditing}>
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Elimina Paziente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Stai per eliminare definitivamente il paziente <span className="font-bold">{patient?.name}</span>.
                    Questa azione non può essere annullata. I piani assegnati verranno rimossi. Le prestazioni già erogate non verranno eliminate.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeletePatient} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {isDeleting ? 'Eliminazione...' : 'Elimina'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

      </main>

      {/* Pass the full patient object to the modal */}
      {patient && isClientReady && (
        <PatientPlanModal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          patient={patient} // Pass the whole patient object
          availablePlans={allAvailablePlans}
          onSave={handleSavePlans}
        />
      )}

    </>
  );
};

export default PatientProfilePage;



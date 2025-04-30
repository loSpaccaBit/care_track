
'use client';

import type { FC } from 'react';
import { useState, useEffect, Fragment } from 'react'; // Added Fragment
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building, PlusCircle, ClipboardList, Clock, Loader2, Edit, Trash2 } from 'lucide-react'; // Removed BarChart3
import { useToast } from '@/hooks/use-toast';
import type { Company, Plan } from '@/lib/types';
import { addCompany, addPlan, getAllCompanies, getAllPlans, updateData, deleteData } from '@/lib/firebase/firestore-utils'; // Import necessary utils
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Separator } from '@/components/ui/separator'; // Import Separator

// Skeletons
const FormCardSkeleton: FC<{ title: string, description: string }> = ({ title, description }) => (
    <Card className="bg-card border border-border rounded-lg shadow-sm">
        <CardHeader className="bg-accent/10 border-b border-border p-4">
            <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded" />
                <Skeleton className="h-6 w-1/2 rounded" />
            </div>
            <Skeleton className="h-4 w-3/4 mt-1 rounded" />
        </CardHeader>
        <CardContent className="p-4 grid gap-4">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-1/3 rounded justify-self-end" />
        </CardContent>
    </Card>
);

const ListItemSkeleton: FC = () => (
    <div className="flex items-center justify-between p-3 border-b">
        <div className="flex-grow mr-4 space-y-1">
             <Skeleton className="h-4 w-3/5 rounded" />
             <Skeleton className="h-3 w-2/5 rounded" />
        </div>
        <div className="flex space-x-2">
             <Skeleton className="h-8 w-8 rounded" />
             <Skeleton className="h-8 w-8 rounded" />
        </div>
    </div>
);

const AddPage: FC = () => {
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true); // Loading state for initial data fetch
  const [isClientReady, setIsClientReady] = useState(false);

  // State for existing data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Form state for adding/editing company
  const [companyFormData, setCompanyFormData] = useState<Partial<Omit<Company, 'id'>>>({ name: '', address: '', contact: '' });
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // Form state for adding/editing plan
  const [planFormData, setPlanFormData] = useState<Partial<Omit<Plan, 'id'>>>({ name: '', description: '', defaultDuration: 0 });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // State for delete confirmation
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'plan' | 'company'; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Fetch existing companies and plans
  useEffect(() => {
      const fetchData = async () => {
           if (!user || authLoading || !isClientReady) {
               setIsFetchingData(authLoading || !isClientReady);
               return;
           }
          setIsFetchingData(true);
          try {
              const [fetchedCompanies, fetchedPlans] = await Promise.all([
                  getAllCompanies(),
                  getAllPlans()
              ]);
              setCompanies(fetchedCompanies);
              setPlans(fetchedPlans);
          } catch (error) {
              console.error("Error fetching data:", error);
              toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare dati esistenti." });
          } finally {
              setIsFetchingData(false);
          }
      };
      fetchData();
  }, [user, authLoading, isClientReady, toast]);


  // Redirect to login if auth is resolved, user is null, and client is ready
  useEffect(() => {
    if (isClientReady && !authLoading && !user) {
      console.log('AddPage: No user found after loading, redirecting to login.');
      router.replace('/login?redirect=/add');
    }
  }, [isClientReady, authLoading, user, router]);


  // Input Handlers
  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlanInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setPlanFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  // Edit Handlers
  const handleEditCompany = (company: Company) => {
     setEditingCompanyId(company.id);
     setCompanyFormData({ name: company.name, address: company.address, contact: company.contact });
     // Scroll to the form or highlight it if needed
     document.getElementById('company-form-card')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEditPlan = (plan: Plan) => {
     setEditingPlanId(plan.id);
     setPlanFormData({ name: plan.name, description: plan.description, defaultDuration: plan.defaultDuration });
     document.getElementById('plan-form-card')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditCompany = () => {
      setEditingCompanyId(null);
      setCompanyFormData({ name: '', address: '', contact: '' });
  };

  const cancelEditPlan = () => {
      setEditingPlanId(null);
      setPlanFormData({ name: '', description: '', defaultDuration: 0 });
  };


  // Submit Handlers (Combined Add/Edit)
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyFormData.name) {
      toast({ variant: "destructive", title: "Errore", description: "Il nome dell'azienda è obbligatorio." });
      return;
    }
    setIsLoadingCompany(true);
    try {
      if (editingCompanyId) {
        // Update existing company
        await updateData<Company>('companies', editingCompanyId, companyFormData);
        setCompanies(prev => prev.map(c => c.id === editingCompanyId ? { ...c, ...companyFormData } : c));
        toast({ title: "Successo", description: `Azienda "${companyFormData.name}" aggiornata.` });
      } else {
        // Add new company
        const addedCompany = await addCompany(companyFormData as Omit<Company, 'id'>);
        setCompanies(prev => [...prev, addedCompany]); // Add to local state
        toast({ title: "Successo", description: `Azienda "${addedCompany.name}" aggiunta.` });
      }
      cancelEditCompany(); // Reset form and editing state
    } catch (error) {
      console.error("Error saving company:", error);
      toast({ variant: "destructive", title: "Errore", description: error instanceof Error ? error.message : "Impossibile salvare l'azienda." });
    } finally {
      setIsLoadingCompany(false);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planFormData.name || !planFormData.defaultDuration || planFormData.defaultDuration <= 0) {
      toast({ variant: "destructive", title: "Errore", description: "Nome e durata (positiva) del piano sono obbligatori." });
      return;
    }
    setIsLoadingPlan(true);
    try {
      if (editingPlanId) {
        // Update existing plan
        await updateData<Plan>('plans', editingPlanId, planFormData);
        setPlans(prev => prev.map(p => p.id === editingPlanId ? { ...p, ...planFormData } as Plan : p));
        toast({ title: "Successo", description: `Piano "${planFormData.name}" aggiornato.` });
      } else {
        // Add new plan
        const addedPlan = await addPlan(planFormData as Omit<Plan, 'id'>);
        setPlans(prev => [...prev, addedPlan]); // Add to local state
        toast({ title: "Successo", description: `Piano "${addedPlan.name}" aggiunto.` });
      }
      cancelEditPlan(); // Reset form and editing state
    } catch (error) {
      console.error("Error saving plan:", error);
      toast({ variant: "destructive", title: "Errore", description: error instanceof Error ? error.message : "Impossibile salvare il piano." });
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const { id, type, name } = itemToDelete;
      await deleteData(type === 'plan' ? 'plans' : 'companies', id);

      if (type === 'plan') {
        setPlans(prev => prev.filter(p => p.id !== id));
        toast({ title: "Successo", description: `Piano "${name}" eliminato.` });
      } else {
        setCompanies(prev => prev.filter(c => c.id !== id));
        toast({ title: "Successo", description: `Azienda "${name}" eliminata.` });
      }
      setItemToDelete(null); // Close dialog
    } catch (error) {
      console.error(`Error deleting ${itemToDelete.type}:`, error);
      toast({ variant: "destructive", title: "Errore", description: `Impossibile eliminare ${itemToDelete.type === 'plan' ? 'il piano' : "l'azienda"}.` });
    } finally {
      setIsDeleting(false);
    }
  };


  // Render Skeletons if initial auth or data is loading or client not ready
  if (authLoading || isFetchingData || !isClientReady) {
      return (
          <>
              <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10">
                  <Skeleton className="h-7 w-48 rounded bg-primary/80 mx-auto" />
              </header>
               <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">
                   <FormCardSkeleton title="Aggiungi Tipo Prestazione (Piano)" description="Definisci un nuovo tipo di prestazione standard."/>
                   <FormCardSkeleton title="Aggiungi Nuova Azienda" description="Inserisci i dettagli della nuova azienda."/>
                    {/* Removed Statistics Skeleton */}
                    <Card className="bg-card border border-border rounded-lg shadow-sm">
                        <CardHeader className="bg-accent/10 border-b border-border p-4">
                            <Skeleton className="h-6 w-1/3 rounded" />
                        </CardHeader>
                         <CardContent className="p-0">
                             <ListItemSkeleton />
                             <ListItemSkeleton />
                         </CardContent>
                    </Card>
                    <Card className="bg-card border border-border rounded-lg shadow-sm">
                        <CardHeader className="bg-accent/10 border-b border-border p-4">
                            <Skeleton className="h-6 w-1/3 rounded" />
                        </CardHeader>
                         <CardContent className="p-0">
                             <ListItemSkeleton />
                             <ListItemSkeleton />
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

   if (!user) {
       return null;
   }

  return (
     <>
      <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-center">Gestione Piani e Aziende</h1>
      </header>

      <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">

        {/* Removed Statistics Card */}

        {/* Add/Edit Plan Card */}
        <Card id="plan-form-card" className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="bg-accent/10 border-b border-border p-4">
            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              {editingPlanId ? 'Modifica Piano Esistente' : 'Aggiungi Tipo Prestazione (Piano)'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground pt-1">
                {editingPlanId ? `Modifica i dettagli per "${planFormData.name || 'piano selezionato'}".` : 'Definisci un nuovo tipo di prestazione standard.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handlePlanSubmit} className="grid gap-4">
               <div>
                <Label htmlFor="planName">Nome Prestazione</Label>
                <Input
                  id="planName" name="name" required
                  value={planFormData.name || ''} onChange={handlePlanInputChange}
                  className="mt-1" placeholder="es. Medicazione Semplice"
                   disabled={isLoadingPlan}
                />
              </div>
              <div>
                <Label htmlFor="planDescription">Descrizione (Opzionale)</Label>
                 <Textarea
                    id="planDescription" name="description"
                    value={planFormData.description || ''} onChange={handlePlanInputChange}
                    placeholder="Descrivi brevemente la prestazione..."
                    className="mt-1"
                    rows={2}
                     disabled={isLoadingPlan}
                />
              </div>
              <div>
                <Label htmlFor="planDuration">Durata Standard (minuti)</Label>
                <Input
                  id="planDuration" name="defaultDuration" type="number" required min="1"
                  value={planFormData.defaultDuration || ''} onChange={handlePlanInputChange}
                  className="mt-1" placeholder="es. 30"
                   disabled={isLoadingPlan}
                />
              </div>
              <div className="flex justify-end gap-2">
                 {editingPlanId && (
                     <Button type="button" variant="outline" onClick={cancelEditPlan} disabled={isLoadingPlan}>
                         Annulla Modifica
                     </Button>
                 )}
                  <Button type="submit" className="gap-2" disabled={isLoadingPlan}>
                    {isLoadingPlan ? <Loader2 className="animate-spin w-4 h-4" /> : (editingPlanId ? <Edit className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />)}
                    {isLoadingPlan ? (editingPlanId ? 'Salvataggio...' : 'Aggiunta...') : (editingPlanId ? 'Salva Modifiche' : 'Aggiungi Piano')}
                  </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Add/Edit Company Card */}
        <Card id="company-form-card" className="bg-card border border-border rounded-lg shadow-sm">
          <CardHeader className="bg-accent/10 border-b border-border p-4">
            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
              <Building className="w-6 h-6" />
              {editingCompanyId ? 'Modifica Azienda Esistente' : 'Aggiungi Nuova Azienda'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground pt-1">
                {editingCompanyId ? `Modifica i dettagli per "${companyFormData.name || 'azienda selezionata'}".` : 'Inserisci i dettagli della nuova azienda.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleCompanySubmit} className="grid gap-4">
              <div>
                <Label htmlFor="companyName">Nome Azienda</Label>
                <Input
                  id="companyName" name="name" required
                  value={companyFormData.name || ''} onChange={handleCompanyInputChange}
                  className="mt-1" placeholder="es. HealthCare Solutions Srl"
                   disabled={isLoadingCompany}
                />
              </div>
              <div>
                <Label htmlFor="companyAddress">Indirizzo (Opzionale)</Label>
                <Input
                  id="companyAddress" name="address"
                  value={companyFormData.address || ''} onChange={handleCompanyInputChange}
                  className="mt-1" placeholder="es. Via Milano 10, Roma"
                   disabled={isLoadingCompany}
                />
              </div>
               <div>
                <Label htmlFor="companyContact">Contatto (Opzionale)</Label>
                <Input
                  id="companyContact" name="contact" type="tel"
                  value={companyFormData.contact || ''} onChange={handleCompanyInputChange}
                  className="mt-1" placeholder="es. 0212345678"
                   disabled={isLoadingCompany}
                />
              </div>
               <div className="flex justify-end gap-2">
                  {editingCompanyId && (
                     <Button type="button" variant="outline" onClick={cancelEditCompany} disabled={isLoadingCompany}>
                         Annulla Modifica
                     </Button>
                  )}
                  <Button type="submit" className="gap-2" disabled={isLoadingCompany}>
                     {isLoadingCompany ? <Loader2 className="animate-spin w-4 h-4" /> : (editingCompanyId ? <Edit className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />)}
                     {isLoadingCompany ? (editingCompanyId ? 'Salvataggio...' : 'Aggiunta...') : (editingCompanyId ? 'Salva Modifiche' : 'Aggiungi Azienda')}
                  </Button>
               </div>
            </form>
          </CardContent>
        </Card>

         {/* Existing Plans List */}
         <Card>
             <CardHeader className="bg-accent/10 border-b border-border p-4">
                <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">Piani Esistenti</CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                {plans.length > 0 ? (
                     <ul className="divide-y divide-border">
                         {plans.map((plan) => (
                             <li key={plan.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                 <div className="flex-grow mr-4">
                                     <p className="font-medium">{plan.name}</p>
                                     <p className="text-xs text-muted-foreground">{plan.description || 'Nessuna descrizione'} - {plan.defaultDuration} min</p>
                                 </div>
                                 <div className="flex space-x-2">
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditPlan(plan)}>
                                         <Edit className="w-4 h-4" />
                                         <span className="sr-only">Modifica</span>
                                     </Button>
                                     <AlertDialog>
                                         <AlertDialogTrigger asChild>
                                             <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItemToDelete({ id: plan.id, type: 'plan', name: plan.name })}>
                                                 <Trash2 className="w-4 h-4" />
                                                 <span className="sr-only">Elimina</span>
                                             </Button>
                                         </AlertDialogTrigger>
                                         {/* Content moved outside the map */}
                                     </AlertDialog>
                                 </div>
                             </li>
                         ))}
                     </ul>
                 ) : (
                     <p className="text-center text-muted-foreground p-4">Nessun piano esistente.</p>
                 )}
             </CardContent>
         </Card>

         {/* Existing Companies List */}
         <Card>
              <CardHeader className="bg-accent/10 border-b border-border p-4">
                <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">Aziende Esistenti</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 {companies.length > 0 ? (
                     <ul className="divide-y divide-border">
                         {companies.map((company) => (
                             <li key={company.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                 <div className="flex-grow mr-4">
                                     <p className="font-medium">{company.name}</p>
                                     <p className="text-xs text-muted-foreground">{company.address || 'Nessun indirizzo'} - {company.contact || 'Nessun contatto'}</p>
                                 </div>
                                 <div className="flex space-x-2">
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditCompany(company)}>
                                         <Edit className="w-4 h-4" />
                                         <span className="sr-only">Modifica</span>
                                     </Button>
                                     <AlertDialog>
                                         <AlertDialogTrigger asChild>
                                             <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItemToDelete({ id: company.id, type: 'company', name: company.name })}>
                                                 <Trash2 className="w-4 h-4" />
                                                 <span className="sr-only">Elimina</span>
                                             </Button>
                                         </AlertDialogTrigger>
                                          {/* Content moved outside the map */}
                                     </AlertDialog>
                                 </div>
                             </li>
                         ))}
                     </ul>
                 ) : (
                     <p className="text-center text-muted-foreground p-4">Nessuna azienda esistente.</p>
                 )}
              </CardContent>
         </Card>

         {/* Delete Confirmation Dialog */}
         <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                      <AlertDialogDescription>
                         Stai per eliminare {itemToDelete?.type === 'plan' ? 'il piano' : "l'azienda"} <span className="font-bold">{itemToDelete?.name}</span>. Questa azione non può essere annullata.
                         {itemToDelete?.type === 'company' && " (I pazienti associati non verranno eliminati, ma dovranno essere riassegnati ad un'altra azienda)."}
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

export default AddPage;

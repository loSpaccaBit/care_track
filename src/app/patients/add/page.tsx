
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Building, PlusCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Patient, Company } from '@/lib/types';
// Updated imports to use Firestore utils
import { addPatient, getAllCompanies } from '@/lib/firebase/firestore-utils';
import { useAuth } from '@/context/auth-context'; // Use useAuth
import { Skeleton } from '@/components/ui/skeleton';
import { normalizePhoneNumber } from '@/lib/utils'; // Import the normalization function

const AddPatientPage: FC = () => {
  const { loading: authLoading, user } = useAuth(); // Use useAuth directly
  const { toast } = useToast();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Form submission loading
  const [dataLoading, setDataLoading] = useState(true); // Initial data loading (companies)
  const [isClientReady, setIsClientReady] = useState(false); // Track client readiness

  // Initialize patientFormData state
  const [patientFormData, setPatientFormData] = useState<Partial<Omit<Patient, 'id' | 'assignedPlans'>>>({
    name: '',
    companyId: '',
    address: '',
    contact: '',
  });

  useEffect(() => {
    setIsClientReady(true);
  }, []);

   // Fetch companies for dropdown
   useEffect(() => {
     const fetchCompanies = async () => {
       // Wait for auth resolution AND client readiness
       if (!user || authLoading || !isClientReady) {
         setDataLoading(authLoading || !isClientReady); // Still loading if auth or client isn't ready
         return;
       }
       // Set loading true only when fetching data
       setDataLoading(true);
       try {
         const fetchedCompanies = await getAllCompanies();
         setCompanies(fetchedCompanies);
       } catch (error) {
         console.error("Error fetching companies:", error);
         toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare le aziende." });
       } finally {
         setDataLoading(false); // Set loading false after fetching or error
       }
     };
     fetchCompanies();
   }, [user, authLoading, isClientReady, toast]); // Add isClientReady dependency

  // Redirect to login if auth is resolved, user is null, and client is ready
  useEffect(() => {
    if (isClientReady && !authLoading && !user) {
      console.log('AddPatientPage: No user found after loading, redirecting to login.');
      router.replace('/login?redirect=/patients/add'); // Redirect if not logged in
    }
  }, [isClientReady, authLoading, user, router]);


  const handlePatientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPatientFormData(prev => ({ ...prev, [name]: value }));
  };

   const handleCompanySelectChange = (value: string) => {
    setPatientFormData(prev => ({ ...prev, companyId: value }));
  };


  const handleAddPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientFormData.name || !patientFormData.companyId || !patientFormData.address || !patientFormData.contact) {
       toast({
        variant: "destructive",
        title: "Errore",
        description: "Per favore compila tutti i campi obbligatori del paziente.",
      });
      return;
    }
    setIsLoading(true);
    try {
        // Normalize the phone number before saving
        const normalizedContact = normalizePhoneNumber(patientFormData.contact);
        const patientDataToSave = {
            ...patientFormData,
            contact: normalizedContact,
        };

        // Call Firestore addPatient function
        // Ensure assignedPlans is not passed
        const { assignedPlans, ...patientDataForDb } = patientDataToSave;
        const addedPatient = await addPatient(patientDataForDb as Omit<Patient, 'id' | 'assignedPlans'>);
        toast({
            title: "Successo",
            description: `Paziente ${addedPatient.name} aggiunto.`, // Use name from returned object
        });
        // Redirect back to the patients list page after successful addition
        router.push('/patients');
        // No need to setLoading(false) here as we are redirecting
    } catch (error) {
         console.error("Error adding patient:", error);
         toast({
            variant: "destructive",
            title: "Errore",
            description: error instanceof Error ? error.message : "Impossibile aggiungere il paziente.",
        });
         setIsLoading(false); // Stop loading on error if not redirecting
    }
    // setLoading(false) // Set loading false if no redirect on success needed
  };

  // Show loading skeleton if auth, initial data is loading, or client not ready
  if (authLoading || dataLoading || !isClientReady) {
      return (
          <>
              <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
                  <Skeleton className="h-8 w-20 rounded bg-primary/80" />
                  <Skeleton className="h-7 w-48 rounded bg-primary/80 mx-auto" />
                  <div className="w-20"></div>
              </header>
              <main className="flex-grow p-4 md:p-6 lg:p-8">
                   <Card className="bg-card border border-border rounded-lg shadow-sm max-w-2xl mx-auto">
                       <CardHeader className="bg-accent/10 border-b border-border p-4">
                           <div className="flex items-center gap-2">
                              <Skeleton className="w-6 h-6 rounded-full bg-muted" />
                              <Skeleton className="h-6 w-32 rounded bg-muted" />
                           </div>
                           <Skeleton className="h-4 w-4/5 mt-1 rounded bg-muted" />
                       </CardHeader>
                       <CardContent className="p-4 grid gap-4">
                           <Skeleton className="h-10 w-full rounded bg-muted" />
                           <Skeleton className="h-10 w-full rounded bg-muted" />
                           <Skeleton className="h-10 w-full rounded bg-muted" />
                           <Skeleton className="h-10 w-full rounded bg-muted" />
                           <Skeleton className="h-10 w-1/3 rounded bg-muted justify-self-end mt-4" />
                       </CardContent>
                   </Card>
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
       <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-1 text-primary-foreground hover:bg-primary/80 px-2">
          <ArrowLeft className="w-5 h-5" /> Indietro
        </Button>
        <h1 className="text-xl font-bold text-center flex-grow mr-12">Aggiungi Nuovo Paziente</h1>
      </header>

      <main className="flex-grow p-4 md:p-6 lg:p-8">
        <Card className="bg-card border border-border rounded-lg shadow-sm max-w-2xl mx-auto">
          <CardHeader className="bg-accent/10 border-b border-border p-4">
            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
              <UserPlus className="w-6 h-6" />
              Dettagli Paziente
            </CardTitle>
             <CardDescription className="text-sm text-muted-foreground pt-1">
                Inserisci le informazioni per il nuovo paziente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleAddPatientSubmit} className="grid gap-4">
              <div>
                <Label htmlFor="patientName">Nome Paziente</Label>
                <Input
                  id="patientName" name="name" required
                  value={patientFormData.name || ''} onChange={handlePatientInputChange}
                  className="mt-1" placeholder="es. Mario Rossi"
                  disabled={isLoading}
                />
              </div>
               <div>
                  <Label htmlFor="companyId">Azienda di Riferimento</Label>
                    <Select name="companyId" value={patientFormData.companyId || ''} onValueChange={handleCompanySelectChange} required disabled={isLoading || companies.length === 0}>
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Seleziona un'azienda" />
                        </SelectTrigger>
                        <SelectContent>
                            {companies.length > 0 ? companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                                {company.name}
                            </SelectItem>
                            )) : <SelectItem value="no-companies" disabled>Nessuna azienda disponibile. Aggiungine una tramite la pagina 'Aggiungi'.</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>
              <div>
                <Label htmlFor="patientAddress">Indirizzo</Label>
                <Input
                  id="patientAddress" name="address" required
                  value={patientFormData.address || ''} onChange={handlePatientInputChange}
                  className="mt-1" placeholder="es. Via Roma 1, Milano"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="patientContact">Contatto Telefonico</Label>
                <Input
                  id="patientContact" name="contact" type="tel" required
                  value={patientFormData.contact || ''} onChange={handlePatientInputChange}
                  className="mt-1" placeholder="es. 3331234567 oppure +393331234567"
                  disabled={isLoading}
                />
                 <p className="text-xs text-muted-foreground mt-1">Verrà normalizzato (es. +393331234567 diventerà 3331234567).</p>
              </div>
              <Button type="submit" className="w-full md:w-auto justify-self-end gap-2 mt-4" disabled={isLoading || companies.length === 0}>
                 {isLoading ? (
                    <>
                        <Loader2 className="animate-spin w-4 h-4" /> Salvataggio...
                    </>
                 ) : (
                     <>
                        <PlusCircle className="w-4 h-4" /> Aggiungi Paziente
                     </>
                 )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default AddPatientPage;


'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react'; // Import useCallback
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, User, Building, UserPlus, ListChecks, Loader2 } from 'lucide-react'; // Added Loader2
import type { Patient, Company, AssignedPlan } from '@/lib/types'; // Added AssignedPlan type
// Updated imports to use Firestore utils
import { getAllPatients, getAllCompanies, getAssignedPlansForPatient } from '@/lib/firebase/firestore-utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context'; // Use useAuth
import { useRouter } from 'next/navigation'; // Import useRouter

// Skeleton for Patient Card
const PatientCardSkeleton: FC = () => (
    <Card className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
        <CardHeader className="p-4 bg-muted/30 border-b border-border">
            <Skeleton className="h-6 w-3/5 rounded" />
            <Skeleton className="h-4 w-2/5 mt-1 rounded" />
        </CardHeader>
        <CardContent className="p-4 flex-grow flex flex-col justify-end">
            <Skeleton className="h-3 w-1/4 mb-2 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
        </CardContent>
    </Card>
);


const PatientsPage: FC = () => {
  const { loading: authLoading, user } = useAuth(); // Use useAuth directly
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [companies, setCompanies] = useState<Record<string, Company>>({});
  const [assignedPlansCounts, setAssignedPlansCounts] = useState<Record<string, number>>({}); // State for plan counts
  const [isLoading, setIsLoading] = useState(true); // Page-specific loading state
  const [isClientReady, setIsClientReady] = useState(false); // Track client readiness

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Define stable toast function using useCallback
  const showToast = useCallback(toast, []);

  // Fetch patients and companies from Firestore
  useEffect(() => {
     const fetchData = async () => {
       // Ensure loading is true when starting fetch
       setIsLoading(true);
       console.log("PatientsPage: Starting data fetch...");
       try {
         // Fetch patients and companies in parallel
         const [fetchedPatients, fetchedCompanies] = await Promise.all([
           getAllPatients(),
           getAllCompanies(),
         ]);
         console.log("PatientsPage: Fetched patients and companies.");

         // Fetch assigned plans count for each patient
         const planCounts: Record<string, number> = {};
         // Use Promise.all for potentially faster plan count fetching
         await Promise.all(fetchedPatients.map(async (patient) => {
           try {
             const plans = await getAssignedPlansForPatient(patient.id);
             planCounts[patient.id] = plans.length;
           } catch (planError) {
             console.error(`PatientsPage: Error fetching plans for patient ${patient.id}:`, planError);
             planCounts[patient.id] = 0; // Default to 0 if error occurs
           }
         }));
         console.log("PatientsPage: Fetched plan counts.");


         setPatients(fetchedPatients);
         setCompanies(Object.fromEntries(fetchedCompanies.map(c => [c.id, c])));
         setAssignedPlansCounts(planCounts); // Set the counts
         console.log("PatientsPage: Data fetch successful.");

       } catch (error) {
         console.error("PatientsPage: Error fetching main data:", error);
         showToast({ variant: "destructive", title: "Errore", description: "Impossibile caricare i dati." });
       } finally {
         console.log("PatientsPage: Setting loading to false.");
         setIsLoading(false); // Stop loading page data regardless of success/error
       }
     };
     // Only fetch data if auth is resolved, user exists, and client is ready
     if (!authLoading && user && isClientReady) {
        fetchData();
     } else if (!authLoading && !user && isClientReady) {
        // If auth is resolved, no user, and client ready, stop loading (redirect handled by context)
        console.log("PatientsPage: No user, setting loading to false.");
        setIsLoading(false);
        setPatients([]); // Clear data if no user
        setCompanies({});
        setAssignedPlansCounts({});
     } else {
        // If auth is loading or client not ready, ensure loading state reflects this
        setIsLoading(authLoading || !isClientReady);
        console.log(`PatientsPage: Waiting for auth/client ready. AuthLoading: ${authLoading}, ClientReady: ${isClientReady}`);
     }
     // Dependencies: Fetch when user logs in/out, auth state resolves, or client becomes ready.
     // Using user?.uid makes it stable if only authentication matters.
   }, [user?.uid, authLoading, isClientReady, showToast]); // Use stable showToast


  const filteredPatients = useMemo(() => {
    if (!searchTerm) {
      return patients;
    }
    return patients.filter((patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [patients, searchTerm]);

  const getCompanyName = (companyId: string): string => {
    return companies[companyId]?.name || 'Azienda Sconosciuta';
  };

  // Function to get the count from state
  const getAssignedPlanCount = (patientId: string): number => {
    return assignedPlansCounts[patientId] ?? 0;
  }

   // Render page skeleton ONLY when page-specific data is loading (after auth check)
   // Check isLoading AND isClientReady to ensure skeletons show correctly after initial mount
   if ((isLoading || authLoading) && isClientReady) {
    console.log(`PatientsPage: Rendering skeleton. IsLoading: ${isLoading}, AuthLoading: ${authLoading}`);
    return (
        <>
            <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
                 <h1 className="text-xl md:text-2xl font-bold text-center flex-grow">Gestione Pazienti</h1>
                 <Button size="sm" variant="secondary" className="gap-1 shrink-0" disabled>
                      <UserPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Aggiungi Paziente</span>
                      <span className="sm:hidden">Aggiungi</span>
                 </Button>
            </header>
             <main className="flex-grow p-4 md:p-6 lg:p-8">
                 <div className="mb-6 relative">
                      <Skeleton className="h-10 w-full rounded-lg bg-muted" />
                 </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                     <PatientCardSkeleton />
                     <PatientCardSkeleton />
                     <PatientCardSkeleton />
                 </div>
             </main>
        </>
    );
   }

   // AuthProvider handles the generic loading/redirect state.
   // Check for !user after loading is complete
   if (!authLoading && !user && isClientReady) {
     // AuthProvider should redirect, but render loader just in case
     console.log("PatientsPage: Rendering loader while redirecting (no user).");
     return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <p className="mt-2 text-muted-foreground">Accesso richiesto...</p>
         </div>
      );
   }


   // Render actual content only if user exists, client is ready, and page is not loading
   if (user && !isLoading && isClientReady) {
    console.log("PatientsPage: Rendering actual content.");
    return (
        <>
        <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-center flex-grow">Gestione Pazienti</h1>
            <Link href="/patients/add" passHref legacyBehavior>
            <Button size="sm" variant="secondary" className="gap-1 shrink-0">
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Aggiungi Paziente</span>
                    <span className="sm:hidden">Aggiungi</span>
                </Button>
            </Link>
        </header>

        <main className="flex-grow p-4 md:p-6 lg:p-8">
            <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Cerca paziente per nome o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-card border border-border rounded-lg shadow-sm focus-visible:ring-primary"
            />
            </div>

            {filteredPatients.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPatients.map((patient) => (
                <Link key={patient.id} href={`/patient/${patient.id}`} passHref legacyBehavior>
                    <a className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
                    <Card className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
                        <CardHeader className="p-4 bg-accent/10 border-b border-border">
                            <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2 cursor-pointer group-hover:underline">
                                <User className="w-5 h-5" />
                                {patient.name}
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground pt-1 flex items-center gap-1.5">
                                <Building className="w-4 h-4" />
                                {getCompanyName(patient.companyId)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 flex-grow flex flex-col justify-end">
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">ID: {patient.id}</p>
                            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <ListChecks className="w-4 h-4 text-accent" />
                                {/* Use the function to get count from state */}
                                <span>Piani Assegnati: {getAssignedPlanCount(patient.id)}</span>
                            </div>
                        </div>
                        </CardContent>
                    </Card>
                    </a>
                </Link>
                ))}
            </div>
            ) : (
            <p className="text-center text-muted-foreground mt-8">
                {searchTerm ? 'Nessun paziente trovato.' : 'Nessun paziente disponibile. Clicca su "Aggiungi Paziente" per iniziare.'}
            </p>
            )}
        </main>
        </>
    );
   }

   // Default return if none of the above conditions are met (should be rare)
   // This often indicates an unexpected state, potentially during initial client load before isClientReady is true
   console.log(`PatientsPage: Rendering fallback loader (unexpected state). IsLoading: ${isLoading}, AuthLoading: ${authLoading}, ClientReady: ${isClientReady}, User: ${!!user}`);
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Caricamento...</p>
        </div>
    );
};

export default PatientsPage;

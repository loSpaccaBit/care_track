
'use client';

import type { FC } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ArrowLeft, Building, User, Clock, Sigma } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getAllServices, getAllCompanies, getAllPatients } from '@/lib/firebase/firestore-utils';
import type { Service, Company, Patient } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

// Helper function to format minutes
const formatDuration = (totalMinutes: number): string => {
  if (totalMinutes === 0) return '0 minuti';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'ora' : 'ore'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}`);
  }
  return parts.join(' e ');
};

// Define the structure for calculated statistics
interface StatisticsData {
  totalOverallMinutes: number;
  hoursPerCompany: { [companyId: string]: { name: string; totalMinutes: number; serviceCount: number } };
  hoursPerPatient: { [patientId: string]: { name: string; totalMinutes: number; serviceCount: number } };
  totalServices: number;
}


const StatisticsPage: FC = () => {
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();
  const [isClientReady, setIsClientReady] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for stats data

  // Use the specific StatisticsData interface for state
  const [statsData, setStatsData] = useState<StatisticsData | null>(null);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Fetch statistics data
  useEffect(() => {
    const fetchStats = async () => {
      if (!user || authLoading || !isClientReady) {
        setIsLoadingData(authLoading || !isClientReady);
        return;
      }
      setIsLoadingData(true);
      try {
        // --- Fetch data from Firestore ---
        const [services, companies, patients] = await Promise.all([
          getAllServices(),
          getAllCompanies(),
          getAllPatients(),
        ]);

        // Create lookup maps
        const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
        const patientMap = Object.fromEntries(patients.map(p => [p.id, p.name]));

        // --- Calculate statistics ---
        let totalOverallMinutes = 0;
        const hoursPerCompany: StatisticsData['hoursPerCompany'] = {};
        const hoursPerPatient: StatisticsData['hoursPerPatient'] = {};
        let totalServices = services.length;

        services.forEach(service => {
          const duration = service.durationMinutes || 0;
          totalOverallMinutes += duration;

          // Per Company
          const companyId = service.companyId;
          const companyName = companyMap[companyId] || 'Azienda Sconosciuta';
          if (!hoursPerCompany[companyId]) {
            hoursPerCompany[companyId] = { name: companyName, totalMinutes: 0, serviceCount: 0 };
          }
          hoursPerCompany[companyId].totalMinutes += duration;
          hoursPerCompany[companyId].serviceCount += 1;

          // Per Patient
          const patientId = service.patientId;
          const patientName = patientMap[patientId] || 'Paziente Sconosciuto';
           if (!hoursPerPatient[patientId]) {
            hoursPerPatient[patientId] = { name: patientName, totalMinutes: 0, serviceCount: 0 };
          }
          hoursPerPatient[patientId].totalMinutes += duration;
          hoursPerPatient[patientId].serviceCount += 1;
        });

        setStatsData({
          totalOverallMinutes,
          hoursPerCompany,
          hoursPerPatient,
          totalServices,
        });

      } catch (error) {
        console.error("Error fetching statistics:", error);
        setStatsData(null); // Indicate error or no data
        // Optionally show a toast message
        // toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile caricare le statistiche.' });
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchStats();
  }, [user, authLoading, isClientReady]);


   if (authLoading || !isClientReady) {
     return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }

  // Redirect if not logged in (Auth Provider should also handle this)
  if (!user && isClientReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  // Show loading skeleton while fetching stats data
  if (isLoadingData) {
     return (
       <>
         <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
            <Skeleton className="h-8 w-20 rounded bg-primary/80" />
            <Skeleton className="h-7 w-48 rounded bg-primary/80 mx-auto" />
            <div className="w-20"></div> {/* Spacer */}
         </header>
         <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">
             {/* Skeleton for Overall Stats */}
             <Card>
                 <CardHeader>
                      <Skeleton className="h-6 w-1/2 rounded" />
                      <Skeleton className="h-4 w-3/4 mt-1 rounded" />
                 </CardHeader>
                 <CardContent className="space-y-2">
                      <Skeleton className="h-5 w-1/3 rounded" />
                      <Skeleton className="h-5 w-1/4 rounded" />
                 </CardContent>
             </Card>
              {/* Skeleton for Company Stats */}
              <Card>
                 <CardHeader>
                      <Skeleton className="h-6 w-1/3 rounded" />
                 </CardHeader>
                 <CardContent className="space-y-3">
                      <div className="flex justify-between"><Skeleton className="h-4 w-2/5 rounded" /><Skeleton className="h-4 w-1/4 rounded" /></div>
                      <Skeleton className="h-px w-full bg-muted" />
                      <div className="flex justify-between"><Skeleton className="h-4 w-1/2 rounded" /><Skeleton className="h-4 w-1/5 rounded" /></div>
                      <Skeleton className="h-px w-full bg-muted" />
                      <div className="flex justify-between"><Skeleton className="h-4 w-2/5 rounded" /><Skeleton className="h-4 w-1/6 rounded" /></div>
                 </CardContent>
             </Card>
              {/* Skeleton for Patient Stats */}
              <Card>
                 <CardHeader>
                      <Skeleton className="h-6 w-1/3 rounded" />
                 </CardHeader>
                 <CardContent className="space-y-3">
                      <div className="flex justify-between"><Skeleton className="h-4 w-2/5 rounded" /><Skeleton className="h-4 w-1/4 rounded" /></div>
                      <Skeleton className="h-px w-full bg-muted" />
                      <div className="flex justify-between"><Skeleton className="h-4 w-1/2 rounded" /><Skeleton className="h-4 w-1/5 rounded" /></div>
                      <Skeleton className="h-px w-full bg-muted" />
                      <div className="flex justify-between"><Skeleton className="h-4 w-2/5 rounded" /><Skeleton className="h-4 w-1/6 rounded" /></div>
                 </CardContent>
             </Card>
         </main>
       </>
     );
  }

  // Render content when user is logged in and data is loaded
  return (
    <>
        <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="flex items-center gap-1 text-primary-foreground hover:bg-primary/80 px-2">
              <ArrowLeft className="w-5 h-5" /> Indietro
            </Button>
            <h1 className="text-xl font-bold text-center flex-grow mr-12">Statistiche</h1>
        </header>

        <main className="flex-grow p-4 md:p-6 lg:p-8 grid gap-6 pb-24">
            {statsData ? (
                <>
                    {/* Overall Statistics Card */}
                    <Card>
                        <CardHeader>
                             <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                                <Sigma className="w-6 h-6"/>
                                Riepilogo Generale
                             </CardTitle>
                            <CardDescription>Dati aggregati su tutte le prestazioni registrate.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-base">
                             <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-accent"/>
                                <strong>Ore Totali Lavorate:</strong> {formatDuration(statsData.totalOverallMinutes)}
                            </div>
                             <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-accent"/>
                                <strong>Aziende Servite:</strong> {Object.keys(statsData.hoursPerCompany).length}
                            </div>
                             <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-accent"/>
                                <strong>Pazienti Assistiti:</strong> {Object.keys(statsData.hoursPerPatient).length}
                            </div>
                             <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-accent"/>
                                <strong>Prestazioni Totali:</strong> {statsData.totalServices}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Statistics per Company Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                                <Building className="w-6 h-6"/>
                                Ore per Azienda
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.keys(statsData.hoursPerCompany).length > 0 ? (
                                <ScrollArea className="max-h-60">
                                    <ul className="space-y-3">
                                        {Object.entries(statsData.hoursPerCompany)
                                            .sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes) // Sort by minutes descending
                                            .map(([id, companyStats]) => (
                                            <li key={id} className="text-sm border-b pb-2 last:border-b-0 last:pb-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">{companyStats.name}</span>
                                                    <span className="text-muted-foreground">{formatDuration(companyStats.totalMinutes)} ({companyStats.serviceCount} prest.)</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            ) : (
                                <p className="text-muted-foreground text-sm text-center">Nessuna prestazione registrata per le aziende.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Statistics per Patient Card */}
                    <Card>
                        <CardHeader>
                             <CardTitle className="text-xl font-semibold text-primary flex items-center gap-2">
                                <User className="w-6 h-6"/>
                                Ore per Paziente
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {Object.keys(statsData.hoursPerPatient).length > 0 ? (
                                <ScrollArea className="max-h-60">
                                    <ul className="space-y-3">
                                         {Object.entries(statsData.hoursPerPatient)
                                            .sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes) // Sort by minutes descending
                                            .map(([id, patientStats]) => (
                                            <li key={id} className="text-sm border-b pb-2 last:border-b-0 last:pb-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">{patientStats.name}</span>
                                                    <span className="text-muted-foreground">{formatDuration(patientStats.totalMinutes)} ({patientStats.serviceCount} prest.)</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            ) : (
                                <p className="text-muted-foreground text-sm text-center">Nessuna prestazione registrata per i pazienti.</p>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : (
                 <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">Nessun dato statistico disponibile o errore nel caricamento.</p>
                    </CardContent>
                </Card>
            )}
        </main>
    </>
  );
};

export default StatisticsPage;

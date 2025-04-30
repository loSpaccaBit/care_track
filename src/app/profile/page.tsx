
'use client';

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import Link
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Settings, LogOut, Loader2, Bell, BellOff, BarChart3 } from 'lucide-react'; // Added BarChart3
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { usePushNotifications } from '@/hooks/usePushNotifications'; // Import the custom hook


const ProfilePage: FC = () => {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isClientReady, setIsClientReady] = useState(false);
    // Use the custom hook for push notification state
    const {
        isPushEnabled,
        isPushLoading,
        isPushSupported,
        permissionState,
        togglePushNotifications,
        requestPermission // Added requestPermission
    } = usePushNotifications();

    // Define stable toast function
    const showToast = useCallback(toast, []);

    // Ensure component only fully renders/redirects on client
    useEffect(() => {
      setIsClientReady(true);
    }, []);


    // Redirect to login if auth is resolved, user is null, and client is ready
    useEffect(() => {
      if (isClientReady && !authLoading && !user) {
        console.log('ProfilePage: No user found after loading, redirecting to login.');
        router.replace('/login?redirect=/profile');
      }
    }, [isClientReady, authLoading, user, router]);


    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            // Unsubscribe from push notifications before logging out if enabled
            if (isPushEnabled) {
                 console.log('[ProfilePage] Attempting to unsubscribe from push before logout...');
                 await togglePushNotifications(); // This now correctly unsubscribes
                 console.log('[ProfilePage] Unsubscribed successfully.');
            } else {
                 console.log('[ProfilePage] Push was not enabled, skipping unsubscribe.');
            }

            console.log('[ProfilePage] Logging out Firebase user...');
            await signOut(auth);
            showToast({ // Use the stable showToast
                title: 'Logout Effettuato',
                description: 'Sei stato disconnesso.',
            });
             // Redirect happens automatically via AuthProvider
        } catch (error) {
            console.error('Logout Error:', error);
            showToast({ // Use the stable showToast
                variant: 'destructive',
                title: 'Errore Logout',
                description: 'Impossibile effettuare il logout. Riprova.',
            });
            setIsLoggingOut(false); // Only set false on error
        }
        // No need to set isLoggingOut to false on success because of redirect
    };

    // Modified handler to explicitly request permission if needed
    const handleNotificationToggle = async () => {
        console.log('[ProfilePage] Notification toggle button clicked.');

        // If permission is 'default', explicitly request it first.
        if (permissionState === 'default') {
             console.log("[ProfilePage] Permission is 'default', requesting permission...");
             const permissionResult = await requestPermission(); // Use the explicit request function
             if (permissionResult !== 'granted') {
                console.log("[ProfilePage] Permission request denied or dismissed.");
                 // Optionally show a toast explaining why notifications aren't enabled
                 if (permissionResult === 'denied') {
                     showToast({
                         variant: 'destructive',
                         title: 'Permesso Negato',
                         description: 'Le notifiche sono bloccate. Modifica i permessi nelle impostazioni.',
                     });
                 } else {
                      showToast({
                         title: 'Permesso Richiesto',
                         description: 'Abilita le notifiche per ricevere promemoria.',
                     });
                 }
                 return; // Stop if permission wasn't granted
             }
             // If granted, proceed to toggle (which will now subscribe)
             console.log("[ProfilePage] Permission granted. Proceeding to subscribe...");
        }

        // Now call the toggle function - it will subscribe if permission is granted
        // or unsubscribe if already enabled.
        await togglePushNotifications();

        // Optional: Trigger scheduling immediately after enabling, if needed.
        // Requires coordination with how appointments are fetched/sent to SW.
        // if (!isPushEnabled && navigator.serviceWorker.controller) { // Check if it was just enabled
        //    console.log("Triggering immediate schedule check after enabling push.");
        //    // You might need a way to get current appointments here or trigger a refresh
        //    // const appointments = await fetchAppointmentsForToday(); // Example
        //    // navigator.serviceWorker.controller.postMessage({ type: 'SCHEDULE_APPOINTMENTS', payload: appointments });
        // }
    };


     if (authLoading || !isClientReady) {
        return (
           <>
            <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10">
                <Skeleton className="h-7 w-32 rounded bg-primary/80 mx-auto" />
            </header>
            <main className="flex-grow p-4 md:p-6 lg:p-8">
                 <Card className="bg-card border border-border rounded-lg shadow-sm overflow-hidden max-w-lg mx-auto">
                    <CardHeader className="bg-accent/10 p-6 flex flex-col items-center text-center">
                        <Skeleton className="w-24 h-24 mb-4 rounded-full bg-muted" />
                        <Skeleton className="h-7 w-40 rounded bg-muted mb-2" />
                        <Skeleton className="h-4 w-32 rounded bg-muted" />
                    </CardHeader>
                    <CardContent className="p-6 grid gap-4">
                        <div className="flex items-center gap-3">
                             <Skeleton className="w-5 h-5 rounded bg-muted" />
                             <Skeleton className="h-4 w-full rounded bg-muted" />
                         </div>
                         <Separator />
                         <div className="flex items-center gap-3">
                             <Skeleton className="w-5 h-5 rounded bg-muted" />
                             <Skeleton className="h-4 w-full rounded bg-muted" />
                         </div>
                         <Separator />
                          {/* Skeleton for Notification Button */}
                         <Skeleton className="h-10 w-full mt-4 rounded bg-muted" />
                         {/* Skeleton for Statistics Button */}
                         <Skeleton className="h-10 w-full mt-2 rounded bg-muted" />
                         <Skeleton className="h-10 w-full mt-2 rounded bg-muted" />
                         <Skeleton className="h-10 w-full mt-2 rounded bg-muted" />
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
        console.error("ProfilePage: Render reached with null user despite checks.");
        return null;
    }

     const getInitials = (email: string | null): string => {
        if (!email) return '?';
        const nameParts = email.split('@')[0];
        return nameParts.substring(0, 2).toUpperCase();
    };

    const userEmail = user.email;
    const userInitials = getInitials(userEmail);
    const userAvatarUrl = user.photoURL;

    // Determine button text and icon based on state
    let notificationButtonText = 'Abilita Notifiche Push';
    let NotificationIcon = Bell;
    let isNotificationButtonDisabled = isPushLoading; // Start with loading state

    if (isPushLoading) {
        notificationButtonText = 'Verifica Notifiche...';
        NotificationIcon = Loader2;
    } else if (isPushEnabled) {
         notificationButtonText = 'Disabilita Notifiche Push';
         NotificationIcon = BellOff;
    } else if (permissionState === 'denied') {
        notificationButtonText = 'Notifiche Bloccate';
        NotificationIcon = BellOff; // Or a specific blocked icon if available
        isNotificationButtonDisabled = true; // Disable if denied
    } else if (permissionState === 'default') {
         notificationButtonText = 'Abilita Notifiche Push';
         NotificationIcon = Bell;
         // Keep button enabled to allow requesting permission
    }


  return (
     <>
      <header className="bg-primary text-primary-foreground p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-center">Profilo Utente</h1>
      </header>

      <main className="flex-grow p-4 md:p-6 lg:p-8 pb-24">
        <Card className="bg-card border border-border rounded-lg shadow-sm overflow-hidden max-w-lg mx-auto">
          <CardHeader className="bg-accent/10 p-6 flex flex-col items-center text-center">
             <Avatar className="w-24 h-24 mb-4 border-2 border-primary">
                {userAvatarUrl ? (
                     <AvatarImage src={userAvatarUrl} alt={userEmail || 'User Avatar'} />
                ) : (
                    <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                        {userInitials}
                    </AvatarFallback>
                )}
             </Avatar>
            <CardTitle className="text-xl font-semibold text-primary">{userEmail}</CardTitle>
            <CardDescription className="text-muted-foreground">Infermiere Professionale</CardDescription>
          </CardHeader>

          <CardContent className="p-6 grid gap-4">
             <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-accent" />
                <span className="text-sm text-foreground">{userEmail}</span>
             </div>
             <Separator />
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-accent" />
                <span className="text-sm text-muted-foreground italic">
                    {user.phoneNumber || 'Numero non fornito'}
                </span>
              </div>
             <Separator />

              {/* Notification Toggle Button using the hook */}
              {isPushSupported ? (
                    <Button
                        variant="outline"
                        className="w-full mt-4 gap-2"
                        onClick={handleNotificationToggle}
                        disabled={isNotificationButtonDisabled} // Use the derived disabled state
                    >
                        <NotificationIcon className={`w-4 h-4 ${isPushLoading ? 'animate-spin' : ''}`} />
                        {notificationButtonText}
                     </Button>
               ) : (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                         Le notifiche push non sono supportate su questo browser.
                    </p>
               )}
               {permissionState === 'denied' && (
                   <p className="text-xs text-destructive text-center -mt-2">
                       Le notifiche sono bloccate. Modifica i permessi nelle impostazioni del browser/dispositivo.
                   </p>
               )}

              {/* Statistics Button */}
              <Link href="/statistics" passHref legacyBehavior>
                  <Button variant="outline" className="w-full mt-2 gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Visualizza Statistiche
                  </Button>
              </Link>

             <Button variant="outline" className="w-full mt-2 gap-2" disabled>
                <Settings className="w-4 h-4" />
                Modifica Profilo (Funzionalità Futura)
             </Button>
              <Button
                variant="destructive"
                className="w-full mt-2 gap-2"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                 {isLoggingOut ? (
                    <>
                       <Loader2 className="animate-spin w-4 h-4" />
                       Disconnessione...
                    </>
                 ) : (
                    <>
                        <LogOut className="w-4 h-4" />
                        Logout
                    </>
                 )}
             </Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default ProfilePage;

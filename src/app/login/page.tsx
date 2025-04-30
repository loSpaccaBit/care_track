
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react'; // Import useEffect
import { useRouter, useSearchParams } from 'next/navigation'; // Import useSearchParams
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, User } from 'lucide-react'; // Import Loader2 for loading state
import Link from 'next/link';
import { useAuth } from '@/context/auth-context'; // Import useAuth to get user directly

const LoginPage: FC = () => {
  // Get user and loading state directly from context for conditional rendering
  const { loading: authLoading, user } = useAuth(); // Use context state

  const router = useRouter();
  const searchParams = useSearchParams(); // Get query parameters
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Form submission loading state
  const [error, setError] = useState<string | null>(null);
  const [isClientReady, setIsClientReady] = useState(false); // State to track client-side readiness

  // Ensure component only renders fully on the client to avoid hydration issues with redirects
  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Effect to redirect if user becomes authenticated *after* component mounts
  // This catches the case where `onAuthStateChanged` updates the context
  useEffect(() => {
    if (!authLoading && user && isClientReady) {
        const redirectPath = searchParams.get('redirect') || '/';
        console.log("Login Page Effect: User authenticated, redirecting to:", redirectPath);
        // Use replace to avoid adding login page to history
        router.replace(redirectPath);
    }
  }, [authLoading, user, isClientReady, router, searchParams]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null); // Reset error on new attempt

    try {
      // Attempt sign in
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Accesso Effettuato',
        description: 'Reindirizzamento in corso...', // Update message
      });
      // Login successful, onAuthStateChanged listener in AuthProvider
      // will update the user state, and the useEffect above will handle the redirect.
      // No need to manually redirect here immediately, as the state change triggers it.
      console.log("Login attempt successful. Waiting for auth state change and redirect effect.");
      // Keep isLoading true until the redirect happens via useEffect

    } catch (err: any) { // Catch specific Firebase error codes if needed
      console.error('Login Error:', err);
      let errorMessage = 'Errore durante l\'accesso. Riprova.';
      // Handle specific Firebase auth errors
      if (err.code === 'auth/invalid-email') {
          errorMessage = 'Indirizzo email non valido.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          // Handles cases where email doesn't exist or password is wrong
          errorMessage = 'Credenziali non valide. Controlla email e password.';
      } else if (err.code === 'auth/too-many-requests') {
          errorMessage = 'Troppi tentativi falliti. Riprova più tardi.';
      } else if (err.code === 'auth/user-disabled') {
          errorMessage = 'Questo account utente è stato disabilitato.';
      }
      setError(errorMessage);
       toast({
        variant: 'destructive',
        title: 'Errore di Accesso',
        description: errorMessage,
      });
       setIsLoading(false); // Set loading to false only if there was an error
    }
    // If successful, the redirect will happen via useEffect, so no setLoading(false) here.
  };

  // Show a loader if either the auth context is loading OR the client isn't ready yet.
  if (authLoading || !isClientReady) {
      return (
           <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
       );
  }

   // If auth is loaded, user exists, and client is ready, the useEffect will redirect.
   // Show a loader while waiting for the redirect triggered by the effect.
   if (user && isClientReady) {
        console.log("Login Page Render: User already logged in, waiting for redirect effect.");
        return (
           <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Reindirizzamento...</p>
           </div>
        );
   }


  // Render the login form only if auth is loaded, user is NOT authenticated, and client is ready
  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary p-4">
      <Card className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg">
        <CardHeader className="text-center bg-primary text-primary-foreground p-6 rounded-t-lg">
           <div className="flex justify-center mb-3">
               {/* If you have a logo component, use it here */}
               <User className="w-10 h-10" />
           </div>
          <CardTitle className="text-2xl font-bold">Accedi a CareTrack</CardTitle>
          <CardDescription className="text-primary-foreground/80">
             Inserisci le tue credenziali per continuare.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tuamail@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading} // Disable input while form is submitting
                className="bg-input border-border focus:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="********" // Added placeholder
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading} // Disable input while form is submitting
                 className="bg-input border-border focus:ring-primary"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full gap-2" disabled={isLoading}>
              {isLoading ? (
                 <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Accesso in corso...
                </>
              ) : (
                 <>
                  <LogIn className="w-4 h-4" />
                  Accedi
                 </>
              )}
            </Button>
          </form>
        </CardContent>
         {/* Optional: Add link to sign up or forgot password */}
         <CardFooter className="p-4 text-center text-sm text-muted-foreground border-t border-border rounded-b-lg">
            {/* Non hai un account?{' '}
           <Link href="/signup" className="underline text-primary hover:text-primary/80">
             Registrati
           </Link> */}
            {/* Placeholder if registration is not needed */}
            Contatta l'amministratore se hai problemi di accesso.
         </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;

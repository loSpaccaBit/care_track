
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { FC, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/firebase';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import { usePathname, useRouter } from 'next/navigation'; // Import hooks for routing
import { Loader2 } from 'lucide-react';

interface AuthContextProps {
  user: User | null;
  loading: boolean; // Represents ONLY the auth state resolution loading
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
});

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup']; // Add other public routes if any

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Tracks ONLY auth state resolution
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('AuthProvider mounting, setting up listener...');
    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('onAuthStateChanged triggered:', currentUser?.email || 'No user');
      setUser(currentUser);
      setLoading(false); // Auth state is now resolved
      console.log('Auth state resolved. User:', currentUser?.email || 'null', 'Loading:', false);
    }, (error) => {
        console.error("Auth state change error:", error);
        // Handle potential errors during initialization
        setUser(null);
        setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
        console.log('AuthProvider unmounting, unsubscribing...');
        unsubscribe();
    };
  }, []); // Run only once on mount

  // Handle redirection logic based on resolved auth state
  useEffect(() => {
    // Only run redirection logic *after* auth state is resolved
    if (!loading) {
      console.log('Auth resolved, checking redirection. Path:', pathname, 'User:', !!user);
      const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

      // Redirect to login if user is not logged in and tries to access a protected route
      if (!user && !isPublicRoute) {
        console.log(`AuthProvider: User not logged in, accessing protected route ${pathname}. Redirecting to /login.`);
        router.replace(`/login?redirect=${pathname}`); // Use replace to avoid history stack issues
      }
      // Optional: Redirect logged-in users away from login/signup
      // else if (user && isPublicRoute) {
      //   console.log(`AuthProvider: User logged in, attempting to access public route ${pathname}. Redirecting to /.`)
      //   router.replace('/'); // Redirect to home or dashboard
      // }
    } else {
        console.log('Auth state not resolved yet, skipping redirection check.');
    }
  }, [loading, user, pathname, router]);


  // === Render Logic ===

  // 1. Show generic loader ONLY while the auth state is initially loading.
  if (loading) {
    console.log("AuthProvider rendering: Auth Loading...");
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
             <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Verifica autenticazione...</p>
             </div>
        </div>
    );
  }

  // 2. Auth is resolved (loading is false). Now check if user exists and route access.
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  // 2a. If no user and accessing a protected route, the redirect is happening via useEffect.
  // Render the generic loader *while* redirecting to avoid flashing content.
  if (!user && !isPublicRoute) {
      console.log("AuthProvider rendering: No user, protected route. Redirecting (showing loader)...");
       return (
           <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
             <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Reindirizzamento al login...</p>
             </div>
           </div>
       );
  }

   // 2b. User exists OR it's a public route (and auth is resolved). Render the children.
   console.log("AuthProvider rendering: Rendering children. User:", !!user, "Public Route:", isPublicRoute);
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

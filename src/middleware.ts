
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Define public routes (accessible without login)
const PUBLIC_ROUTES = ['/login', '/signup']; // Add signup if you implement it
// Define the default route to redirect authenticated users to if they hit a public route
const DEFAULT_AUTHENTICATED_REDIRECT = '/';

export function middleware(request: NextRequest) {
  const { pathname, searchParams, origin } = request.nextUrl;
  // Attempting to check for *any* Firebase-related cookie as a heuristic.
  // NOTE: This is NOT a reliable way to check authentication state from middleware
  // because client-side SDK manages the actual session token (usually in IndexedDB).
  // A proper solution involves server-side session management (e.g., Firebase Session Cookies).
  const hasSomeFirebaseAuthCookie = request.cookies.has('firebaseAuthToken') || request.cookies.getAll().some(cookie => cookie.name.startsWith('firebase-installations') || cookie.name.startsWith('firebase-exp')); // Example heuristic, check actual cookie names in dev tools

  console.log(`Middleware: Pathname: ${pathname}`);
  console.log(`Middleware: Heuristic check for Firebase cookie found: ${hasSomeFirebaseAuthCookie}`);

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  // Scenario 1: User seems authenticated (heuristic) and tries to access a public/auth route
  if (hasSomeFirebaseAuthCookie && isPublicRoute) {
    const redirectParam = searchParams.get('redirect');
    // Check if the redirect parameter is valid and not pointing back to a public route
    const isValidRedirect = redirectParam && !PUBLIC_ROUTES.some(route => redirectParam.startsWith(route));
    const redirectTo = isValidRedirect ? redirectParam : DEFAULT_AUTHENTICATED_REDIRECT;

    console.log(`Middleware: Authenticated user (heuristic) accessing public route ${pathname}. Redirecting to ${redirectTo}.`);
    // Ensure the redirectTo path starts with '/' for proper URL construction
    const redirectUrl = new URL(redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`, origin);
    return NextResponse.redirect(redirectUrl);
  }

  // Scenario 2: Unauthenticated user tries to access a protected route
  // We *cannot* reliably detect unauthenticated users here just based on cookies
  // for client-side SDK authentication. The client-side app (AuthProvider/useAuthRedirect)
  // needs to handle redirecting to login after the Firebase SDK initializes.
  // The middleware *could* redirect *all* non-public routes to login if no cookie heuristic matches,
  // but this might interfere with the client-side auth flow.
  // Let's allow the request for now and let client-side handle the auth check.
  // if (!hasSomeFirebaseAuthCookie && !isPublicRoute) {
     // console.log(`Middleware: Potential unauthenticated user accessing protected route ${pathname}. Allowing client-side check.`);
     // **Decision:** Avoid redirecting to login from middleware based *only* on missing cookies
     // because the client SDK might still be initializing or restoring the session.
     // Let the client handle the redirect to login if needed.
  // }


  // Allow the request to proceed
  console.log(`Middleware: Allowing request to proceed for ${pathname}. Client-side will verify auth state.`);
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons/ (PWA icons)
     * - manifest.json (PWA manifest)
     * - various asset files (png, jpg, svg, webp, etc.)
     * - sw.js (service worker)
     * - workbox-* (workbox files)
     * - *.js (javascript files in public root)
     *
     * This matcher needs to include public routes like /login
     * so the middleware can redirect *away* from them if the user *is* authenticated (heuristic).
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons/.*|manifest.json|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$|sw.js|workbox-.*|.*\\.js$).*)',
  ],
};

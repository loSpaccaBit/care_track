
import type { Metadata, Viewport } from 'next'; // Import Viewport
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import BottomNav from '@/components/navigation/bottom-nav';
import { AuthProvider } from '@/context/auth-context'; // Import AuthProvider
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

// Define viewport settings for PWA theme color and disable zoom
export const viewport: Viewport = {
  themeColor: '#00796B', // Match theme_color in manifest.json
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Disable zooming
  userScalable: false, // Disable zooming
};

export const metadata: Metadata = {
  title: 'CareTrack Mobile',
  description: 'Track nursing home care services efficiently.',
  manifest: '/manifest.json', // Link to the web app manifest
  // Add basic PWA meta tags
  appleWebAppCapable: 'yes',
  appleWebAppStatusBarStyle: 'default', // Or 'black-translucent'
  appleWebAppTitle: 'CareTrack',
  // formatDetection: { telephone: 'no' }, // Optional: Prevent auto-detection of phone numbers
  // Add more relevant PWA or SEO meta tags if needed
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply suppressHydrationWarning to the <html> tag to ignore extension mismatches
    // Apply font variables to the html tag
    <html lang="en" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
      {/* Apply antialiasing and font variables to the body tag */}
      {/* Increase pb-20 to pb-24 for more bottom space */}
      {/* Add suppressHydrationWarning to body if necessary, but prefer on html */}
      <meta name="google-adsense-account" content="ca-pub-6394235100828735" />
      <body className={cn('antialiased pb-24')} suppressHydrationWarning>
        {/* Wrap the entire content with AuthProvider */}
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            {/* Main content area will grow to fill space */}
            <div className="flex-grow">
              {children}
            </div>
          </div>
          <BottomNav /> {/* Render BottomNav inside AuthProvider but outside flex-grow */}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}

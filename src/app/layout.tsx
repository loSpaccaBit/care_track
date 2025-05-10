import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import BottomNav from '@/components/navigation/bottom-nav';
import { AuthProvider } from '@/context/auth-context';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Define viewport settings for PWA theme color and disable zoom
export const viewport: Viewport = {
  themeColor: '#00796B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'CareTrack Mobile',
  description: 'Track nursing home care services efficiently.',
  manifest: '/manifest.json',
  appleWebAppCapable: 'yes',
  appleWebAppStatusBarStyle: 'default',
  appleWebAppTitle: 'CareTrack',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
      <head>
        {/* Google AdSense Script */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6394235100828735"
          crossorigin="anonymous"></script>
        {/* Add Google AdSense meta if needed */}
        <meta name="google-adsense-account" content="ca-pub-6394235100828735" />
      </head>
      <body className={cn('antialiased pb-24')} suppressHydrationWarning>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            {/* Main content area */}
            <div className="flex-grow">
              {children}
            </div>
          </div>
          <BottomNav />
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}

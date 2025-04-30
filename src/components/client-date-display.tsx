
'use client';

import type { FC } from 'react';
import { useEffect, useState } from 'react';
// Removed unused cn import: import { cn } from '@/lib/utils';

interface ClientDateDisplayProps {
  formatOptions: Intl.DateTimeFormatOptions;
  locale: string;
  className?: string; // Allow passing className
}

const ClientDateDisplay: FC<ClientDateDisplayProps> = ({ formatOptions, locale, className }) => {
  const [dateString, setDateString] = useState<string | null>(null);

  useEffect(() => {
    // Format date on the client side after hydration
    // We use a timeout to ensure it runs after the initial render cycle,
    // further reducing potential race conditions during hydration.
    const timer = setTimeout(() => {
      setDateString(new Date().toLocaleDateString(locale, formatOptions));
    }, 0);
    return () => clearTimeout(timer); // Cleanup timeout on unmount
  }, [formatOptions, locale]);

  // Render nothing or a placeholder initially to guarantee matching server render
  // Using a span with min-height can prevent layout shifts if needed
  if (dateString === null) {
    // Optional: Add a placeholder or keep it empty
    // Apply className to the placeholder as well
    return <span className={className}>&nbsp;</span>; // Use placeholder to avoid layout shift
    // return null; // Render nothing initially
  }

  // Use the passed className prop directly
  return <span className={className}>{dateString}</span>;
};

export default ClientDateDisplay;

    

'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, User, Users, ClipboardList } from 'lucide-react'; // Changed Settings to ClipboardList
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context'; // Import useAuth

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/patients', label: 'Pazienti', icon: Users },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/add', label: 'Gestione', icon: ClipboardList }, // Changed icon to ClipboardList
  { href: '/profile', label: 'Profilo', icon: User },
];

const BottomNav: FC = () => {
  const pathname = usePathname();
  const { user } = useAuth(); // Get user authentication state

  // Don't render the nav if the user is not logged in
  if (!user) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-md">
      {/* Increased height (h-20) and bottom padding (pb-4) */}
      <div className="flex justify-around items-center h-20 max-w-lg mx-auto px-2 sm:px-4 pb-4">
        {navItems.map((item) => {
          // More robust active state check: exact match for home, startsWith for others
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link href={item.href} key={item.href} legacyBehavior>
              <a
                className={cn(
                  'flex flex-col items-center justify-center w-full h-full text-xs sm:text-sm transition-colors duration-200 px-1', // Adjusted padding/text size
                  isActive
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground hover:text-primary'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon
                  className={cn(
                    'w-6 h-6 sm:w-7 sm:h-7 mb-1', // Slightly larger icons
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                  )}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[60px] sm:max-w-none">{item.label}</span> {/* Truncate label if needed */}
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

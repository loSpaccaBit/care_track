
import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Hook to determine if the current screen width is considered mobile.
 * Returns `true` if width < MOBILE_BREAKPOINT, `false` otherwise,
 * and `undefined` during initial server render.
 */
export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') {
      return;
    }

    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Initial check
    checkScreenSize()

    // Add event listener for window resize
    window.addEventListener("resize", checkScreenSize)

    // Cleanup listener on component unmount
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  return isMobile
}

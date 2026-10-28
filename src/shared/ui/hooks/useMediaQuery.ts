// src/shared/ui/hooks/useMediaQuery.ts
import { useEffect, useState } from 'react';

export const BREAKPOINTS = {
  mobile: '(min-width: 360px)',
  tablet: '(min-width: 768px)',
  desktop: '(min-width: 1280px)',
  widescreen: '(min-width: 1920px)',
} as const;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', listener);

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}

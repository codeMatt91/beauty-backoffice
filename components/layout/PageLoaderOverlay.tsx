"use client";

import { useNavigation } from "./NavigationProvider";

export default function PageLoaderOverlay() {
  const { isNavigating } = useNavigation();

  if (!isNavigating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-[2px]"
    >
      <div className="relative w-48 h-48 sm:w-64 sm:h-64">
        <img
          src="/la-femme-logo.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-[0.12] dark:invert"
        />
        <div className="absolute inset-0 overflow-hidden animate-logo-fill-sweep">
          <img
            src="/la-femme-logo.svg"
            alt=""
            aria-hidden="true"
            className="w-full h-full opacity-90 dark:invert"
          />
        </div>
      </div>
      <span className="sr-only">Caricamento...</span>
    </div>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Tiene un elemento `position: fixed` agganciato alla *visual viewport*.
 *
 * Su Safari iOS l'apertura della tastiera virtuale non ridimensiona la layout
 * viewport (a cui si riferiscono `position: fixed`, `vh` e `dvh`): riduce solo la
 * visual viewport. Senza questo hook un modale centrato finisce in parte sotto
 * la tastiera.
 *
 * L'hook scrive due CSS custom property direttamente sull'elemento (niente
 * re-render): `--vv-height` e `--vv-top`, più l'attributo `data-vv`. La classe
 * `.dialog-viewport-bound` (globals.css) le usa per centrare e limitare l'altezza.
 * Senza tastiera/zoom la visual viewport coincide con la finestra, quindi su
 * desktop e tablet il risultato è identico al centraggio classico.
 *
 * Al resize, se il focus è dentro l'elemento, riporta in vista il campo attivo.
 *
 * Riceve l'elemento (da una callback ref) e non una RefObject: il contenuto di un
 * Radix Dialog viene montato nel Portal un render dopo l'apertura, quindi una
 * ref.current letta nell'effect sarebbe ancora null e l'effect non ripartirebbe.
 */
export function useVisualViewportBounds<T extends HTMLElement>(
  el: T | null,
  active: boolean
) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv || !el) return;

    let frame = 0;
    const schedule = (revealFocused: boolean) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--vv-height", `${vv.height}px`);
        el.style.setProperty("--vv-top", `${vv.offsetTop}px`);
        el.setAttribute("data-vv", "");

        // Solo sul resize (apertura/chiusura tastiera): sullo scroll della
        // visual viewport si lotterebbe con il pan dell'utente.
        const focused = document.activeElement;
        if (revealFocused && focused instanceof HTMLElement && el.contains(focused)) {
          focused.scrollIntoView({ block: "nearest" });
        }
      });
    };
    const onResize = () => schedule(true);
    const onScroll = () => schedule(false);

    schedule(false);
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onScroll);
      el.style.removeProperty("--vv-height");
      el.style.removeProperty("--vv-top");
      el.removeAttribute("data-vv");
    };
  }, [el, active]);
}

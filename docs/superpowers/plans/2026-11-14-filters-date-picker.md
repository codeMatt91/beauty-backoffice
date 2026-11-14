# Date picker moderno nei filtri Finanze

## Contesto
- I filtri data sono in `components/finance/FinanceClient.tsx` (barra "Filtri"): due `<input type="date">` nativi che aprono il calendario del browser/OS.
- I valori sono stringhe `yyyy-MM-dd` in stato React (`dateFrom`, `dateTo`). Nessun query param: la pagina non legge `searchParams`.
- `react-day-picker@9.14.0` (MIT) e `@radix-ui/react-popover` sono **già** dipendenze installate (react-day-picker era inutilizzata). `date-fns` + locale `it` già in uso.

## Obiettivo
Solo stile: stesso contratto dati (`value: "yyyy-MM-dd"`, `onChange(string)`), stessa logica di fetch e preset di granularità.

## Decisioni
1. **Nessuna nuova dipendenza** → zero impatto su supply chain e lockfile. Si usa l'entry point principale di react-day-picker (tree-shakable; i calendari alternativi sono subpath non importati).
2. **Niente `style.css` di react-day-picker**: stile solo Tailwind via `classNames`, con i token del tema (`primary`, `accent`, `muted`, `border`, `card`) → coerente in light/dark (regola CLAUDE.md "Tailwind only").
3. Componente riutilizzabile `components/ui/DatePicker.tsx`:
   - Trigger `<button>` con icona calendario e data in formato italiano (`d MMM yyyy`), `aria-label` + `aria-haspopup="dialog"`.
   - `Popover` Radix (portal, `collisionPadding`, chiusura con Esc/click fuori, focus restituito al trigger).
   - `DayPicker mode="single" required` con `locale={it}`, `weekStartsOn={1}`, un mese per volta, `autoFocus` sul giorno selezionato → navigazione da tastiera (frecce, PagSu/PagGiù, Home/Fine) nativa della libreria.
   - Parsing/formatting `yyyy-MM-dd` in **ora locale** (`parse`/`format` di date-fns) per evitare lo slittamento di un giorno dovuto a UTC.
   - Celle 40px su mobile (touch target), 36px da `sm:`; larghezza popover ~300px, entra anche a 320px.
4. **Solo tablet e desktop** (richiesta di Matt): sotto `md` (< 768px) resta l'`<input type="date">` nativo con le classi originali; da `md` in su il nuovo picker. Switch solo CSS (`md:hidden` / `hidden md:inline-flex`), niente `matchMedia` → nessun mismatch di hydration. Opt-in con la prop `nativeOnMobile`.
5. Integrazione: sostituire i due input in `FinanceClient.tsx` mantenendo layout responsive esistente.

## Fuori scope
- `lib/businessHours.ts` e `AppointmentModal.tsx` non toccati.
- Gli altri `type="date"` (CustomerForm, AddExpenseModal) restano nativi: il componente è pronto per adottarli in seguito.

## Verifica
- `tsc --noEmit` e ESLint sui file toccati (dalla VM).
- Sul Mac: `npm run build` e verifica visiva mobile/tablet/desktop, light/dark, tastiera.

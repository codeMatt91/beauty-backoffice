# Searchable Customer Select — Design Spec

**Date:** 2026-08-06
**Status:** Approved

## Problem

In `AppointmentModal.tsx`, il campo cliente è una `<select>` HTML nativa con tutti i clienti come `<option>`. Con un registro clienti che cresce, scorrere una tendina nativa (specialmente su mobile/tablet) è lento e scomodo: l'utente deve conoscere l'ordine alfabetico o scrollare a lungo per trovare il cliente giusto.

## Goal

Sostituire la `<select>` con un campo di ricerca: l'utente digita nome o cognome e la lista dei clienti si filtra ad ogni lettera, restando usabile su mobile e tablet.

## Solution

Introdurre un componente generico `SearchableSelect` in `components/ui/`, basato su Radix Popover (già una dipendenza del progetto, mai usato finora), e usarlo in `AppointmentModal.tsx` al posto della `<select>` cliente.

### Perché Radix Popover

Il dropdown dei risultati deve uscire visivamente dal `Dialog.Content`, che ha `overflow-y-auto` per lo scroll del modale su schermi piccoli. Un dropdown posizionato con `position: absolute` verrebbe tagliato da quello scroll container. `Popover.Content` di Radix è portato in un portal separato (fuori dal DOM del Dialog), quindi non subisce il clipping — motivo tecnico, non solo di convenzione (CLAUDE.md richiede comunque Radix per le primitive interattive).

### Perché non un vero combobox "sempre editabile"

Si è scelto un pattern a due stati (ricerca → selezione bloccata con X per cambiare) invece di un input sempre modificabile: più chiaro su mobile, dove non è ovvio se il testo visibile nell'input è ancora "in ricerca" o è il valore scelto.

## Component API

**File:** `components/ui/SearchableSelect.tsx` (Client Component, `"use client"`)

```typescript
interface SearchableSelectItem {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;                  // id selezionato, "" = nessuna selezione
  onChange: (id: string) => void;
  placeholder?: string;           // default: "Cerca..."
  emptyMessage?: string;          // default: "Nessun risultato"
  ariaLabel: string;              // per l'input, es. "Cliente"
}
```

Generico e riutilizzabile (nessuna dipendenza da `Customer` o da altri tipi del dominio) — potrà servire in futuro per altre select con molte opzioni (es. operatrice).

## Behavior

### Stato "nessuna selezione" (`value === ""`)

- Renderizza un `<input type="text">` collegato a uno stato locale `query`.
- Al focus dell'input si apre `Popover.Content` con la lista filtrata (lista completa se `query` è vuota — comportamento equivalente a cliccare una `<select>`).
- Ad ogni carattere digitato, `query` si aggiorna e la lista si rifiltra istantaneamente (filtro client-side, sincrono — l'elenco clienti è già interamente caricato da `getCustomers()` all'apertura del modale, nessuna nuova chiamata server).
- Click/tap su una voce → `onChange(item.id)`, popover si chiude, `query` viene azzerata.
- Nessun risultato → viene mostrato `emptyMessage` al posto della lista.

### Stato "selezionato" (`value !== ""`)

- L'input mostra il `label` dell'item selezionato in sola visualizzazione (non modificabile direttamente).
- Un bottone X (`aria-label="Cambia cliente"`) accanto al campo, al click: azzera `value` (tramite `onChange("")`) e `query`, riporta il campo in stato di ricerca e sposta il focus sull'input.

### Filtro

Match case-insensitive e accent-insensitive (normalizzazione con `String.prototype.normalize("NFD")`), per parole in AND, ordine libero — così sia "Maria Rossi" sia "Rossi Maria" trovano lo stesso cliente mostrato come label "Cognome Nome":

```typescript
function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const filteredItems = useMemo(() => {
  const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;
  return items.filter((item) => {
    const label = normalize(item.label);
    return tokens.every((t) => label.includes(t));
  });
}, [items, query]);
```

### Mobile/tablet

- `Popover.Content` larga quanto il trigger tramite la CSS var di Radix `--radix-popover-trigger-width`, così il dropdown combacia con l'input anche su schermi stretti.
- `max-h-60 overflow-y-auto` sulla lista, per non superare l'altezza disponibile su viewport piccoli.
- Collision detection di Radix (default `avoidCollisions`) fa ribaltare il popover sopra l'input quando non c'è spazio sotto (es. quando il modale è quasi a fine schermo su mobile).
- Voci lista renderizzate come `<button type="button">` con `py-2.5` di padding verticale, per un target touch adeguato (~40px), coerente con le altre azioni del modale (es. bottone Elimina).
- Nessuna modifica al layout del form: resta mobile-first, colonna singola, come oggi.

## Integration — `AppointmentModal.tsx`

- Import `SearchableSelect` da `components/ui/SearchableSelect`.
- Sostituire il blocco `<select>` del cliente (righe 162-174) con:
  ```tsx
  <SearchableSelect
    items={customers.map((c) => ({ id: c.id, label: `${c.lastName} ${c.firstName}` }))}
    value={customerId}
    onChange={setCustomerId}
    placeholder="Cerca cliente per nome o cognome..."
    emptyMessage="Nessun cliente trovato"
    ariaLabel="Cliente"
  />
  ```
- La `<select>` nativa usava l'attributo `required` per la validazione HTML del browser; `SearchableSelect` non espone un `<select>`/`<input required>` reale, quindi la validazione si sposta in `handleSubmit`:
  ```typescript
  if (!customerId) {
    setError("Seleziona un cliente");
    return;
  }
  ```
  aggiunta prima della `try` esistente, coerente con la gestione errori già presente nel componente (`setError`).

## Out of scope (YAGNI)

- Navigazione con frecce da tastiera nella lista (le voci restano comunque raggiungibili con Tab in quanto `<button>`).
- Ricerca per numero di telefono (solo nome/cognome, come da elenco già mostrato oggi).
- Link/bottone per creare un nuovo cliente quando la ricerca non trova risultati — resta un flusso separato nella pagina `/customers`.
- Ricerca lato server o paginazione — il volume clienti atteso resta compatibile con un filtro client-side sull'elenco già caricato.

## Scope

- **2 file coinvolti:**
  - `components/ui/SearchableSelect.tsx` (nuovo)
  - `components/calendar/AppointmentModal.tsx` (modificato: sostituzione select cliente + validazione in `handleSubmit`)
- Nessuna modifica a Server Actions, Prisma, auth, o routing.
- Nessuna nuova dipendenza npm (Radix Popover è già installato).

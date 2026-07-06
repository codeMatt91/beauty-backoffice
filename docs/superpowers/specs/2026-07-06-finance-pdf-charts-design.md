# Finance PDF Charts — Design Spec

**Date:** 2026-07-06  
**Status:** Approved  
**Scope:** Aggiunta di grafici nei PDF export di `/finance`: torte nel mensile, barre+netto nell'annuale

---

## Problema

I PDF generati da `exportFinancePDF` contengono solo tabelle. L'utente vuole visualizzazioni grafiche che aiutino a leggere la composizione delle entrate/spese (mensile) e l'andamento nel tempo (annuale).

---

## Soluzione

### PDF mensile — due grafici a torta

Dopo la tabella KPI e prima delle tabelle appuntamenti/spese, viene inserita una sezione **"Distribuzione"** con due grafici a torta affiancati:

- **Torta sinistra — Entrate per servizio:** ogni fetta corrisponde a un `serviceType` degli appuntamenti pagati del mese. Dimensione proporzionale all'importo totale per quel servizio.
- **Torta destra — Spese per categoria:** ogni fetta corrisponde a una `ExpenseCategory` (AFFITTO, UTENZE, MATERIALI, PERSONALE, MARKETING, MANUTENZIONE, ALTRO). Dimensione proporzionale all'importo totale per quella categoria.

Ogni torta ha una legenda sotto il grafico con colore + etichetta + importo. Le torte sono posizionate affiancate: sinistra da x=14, destra da x=110, larghezza 80mm ciascuna.

Se non ci sono dati (nessun appuntamento o nessuna spesa), la torta corrispondente mostra un testo "Nessun dato disponibile" al posto del grafico.

### PDF annuale — grafico barre + tabella mensile

Dopo la tabella KPI vengono aggiunte due sezioni:

**1. Grafico "Andamento mensile"**
- Barre affiancate per ciascuno dei 12 mesi dell'anno
- Barra verde (`#10b981`) = entrate del mese
- Barra rossa (`#ef4444`) = uscite del mese
- Linea nera sovrapposta = netto mensile (entrate - uscite)
- Asse X: etichette dei mesi abbreviati in italiano (gen, feb, mar, ...)
- Asse Y: valori in € (scala automatica)
- Larghezza piena pagina (~182mm), altezza ~70mm

**2. Tabella riepilogo mensile**
- Colonne: **Mese** | **Entrate** | **Uscite** | **Netto**
- Una riga per ciascuno dei 12 mesi dell'anno (inclusi mesi a zero)
- Riga di totale annuale in fondo (stile `tfoot` con sfondo scuro)
- Colonna **Netto**: se valore ≥ 0 → `fillColor: [209, 250, 229]`, `textColor: [6, 95, 70]` (verde); se < 0 → `fillColor: [254, 226, 226]`, `textColor: [153, 27, 27]` (rosso)
- Colorazione tramite callback `didParseCell` di jspdf-autotable

Le tabelle individuali di appuntamenti e spese rimangono in fondo al PDF annuale, invariate.

---

## Architettura

### Nuovo file: `lib/chartToImage.ts`

Contiene due funzioni esportate che operano esclusivamente client-side (browser):

```ts
export async function renderPieChart(
  slices: { label: string; value: number }[],
  title: string
): Promise<string>
```
Crea un `<canvas>` 400×400 temporaneo, renderizza un pie chart Chart.js, restituisce `canvas.toDataURL("image/png")`, distrugge il chart, rimuove il canvas.

```ts
export async function renderBarLineChart(
  months: { label: string; entrate: number; uscite: number; netto: number }[]
): Promise<string>
```
Crea un `<canvas>` 800×320 temporaneo, renderizza un bar chart Chart.js con dataset entrate (barre verdi) + uscite (barre rosse) + netto (linea nera), restituisce il data URL PNG, distrugge il chart, rimuove il canvas.

Entrambe le funzioni:
- Appendono il canvas a `document.body` con `visibility: hidden; position: absolute`
- Chiamano `chart.destroy()` e `canvas.remove()` dopo `toDataURL()`
- Non modificano lo stato React né accedono a Server Actions

### Modifica: `lib/exportFinancePDF.ts`

**Ramo `"month"`:**
- Aggiunge aggregazioni client-side:
  - `entratePerServizio`: `Map<string, number>` da `summary.appointments`
  - `spesePerCategoria`: `Map<string, number>` da `summary.expenses`
- Chiama in parallelo `renderPieChart(entratePerServizio)` e `renderPieChart(spesePerCategoria)`
- Inserisce le due immagini PNG nel PDF con `doc.addImage()` dopo la tabella KPI

**Ramo `"year"`:**
- Aggiunge aggregazioni mensili: array di 12 elementi `{ label, entrate, uscite, netto }`
- Chiama `renderBarLineChart(monthlyData)`
- Inserisce l'immagine PNG dopo la tabella KPI
- Aggiunge la tabella mensile con `autoTable` + `didParseCell` per colorare la colonna Netto

### Nuova dipendenza

```bash
npm install chart.js
```

`chart.js` v4: ~200 KB gzipped. Lazy-loaded insieme a `exportFinancePDF` (dynamic import già in `page.tsx`), quindi nessun impatto sul bundle iniziale della pagina.

---

## Dati — nessuna nuova Server Action

Tutti i dati necessari sono già presenti nel risultato di `getFinancialSummary(from, to)`:
- `summary.appointments[].serviceType` + `.price` → aggregazione per servizio
- `summary.expenses[].category` + `.amount` → aggregazione per categoria  
- `summary.appointments[].startTime` + `.price` → aggregazione per mese
- `summary.expenses[].date` + `.amount` → aggregazione per mese

---

## Palette colori grafici

| Uso | Colore |
|---|---|
| Barre entrate (bar chart) | `#10b981` (emerald-500) |
| Barre uscite (bar chart) | `#ef4444` (red-500) |
| Linea netto (line) | `#111827` (gray-900) |
| Netto positivo — sfondo cella | `rgb(209, 250, 229)` |
| Netto positivo — testo cella | `rgb(6, 95, 70)` |
| Netto negativo — sfondo cella | `rgb(254, 226, 226)` |
| Netto negativo — testo cella | `rgb(153, 27, 27)` |
| Torte — palette 8 colori | `['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']` |

---

## Posizionamento immagini nel PDF (unità: mm)

| Elemento | x | y | w | h |
|---|---|---|---|---|
| Torta sinistra (mensile) | 14 | dopo KPI +8 | 80 | 80 |
| Torta destra (mensile) | 108 | stessa y | 80 | 80 |
| Grafico barre (annuale) | 14 | dopo KPI +8 | 182 | 70 |

---

## Fuori scope

- Grafici nel PDF annuale per singoli appuntamenti/spese (le tabelle individuali restano invariate)
- Interattività nei grafici (è un PDF statico)
- Esportazione del grafico Recharts già presente nella UI
- Modifica della struttura del KPI table o delle tabelle esistenti

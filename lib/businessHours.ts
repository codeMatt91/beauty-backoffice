/**
 * Orari di apertura del salone: unica fonte di verità per calendario (UI)
 * e validazione degli appuntamenti (Server Actions).
 *
 * Modulo puro (niente React, niente Prisma): è importabile sia dai Client
 * Components sia dal codice server. Quando verrà introdotto il modello
 * `Salon` (multi-salone), basterà far risolvere `getBusinessHours()` dalla
 * configurazione del salone corrente: i consumer non cambiano.
 */

export interface SalonBusinessHours {
  /** Ora di apertura (inclusa), 0–23. */
  openHour: number;
  /** Ora di chiusura (esclusa), 1–24: l'ultimo slot orario parte alle closeHour-1. */
  closeHour: number;
  /** Fuso IANA del salone: il server su Vercel gira in UTC, quindi va esplicitato. */
  timeZone: string;
}

export const DEFAULT_BUSINESS_HOURS: Readonly<SalonBusinessHours> = Object.freeze({
  openHour: 8,
  closeHour: 21, // ultimo slot prenotabile: 20:00–21:00
  timeZone: "Europe/Rome",
});

function assertValidBusinessHours(h: SalonBusinessHours): void {
  if (
    !Number.isInteger(h.openHour) ||
    !Number.isInteger(h.closeHour) ||
    h.openHour < 0 ||
    h.closeHour > 24 ||
    h.openHour >= h.closeHour
  ) {
    throw new Error(`Orari del salone non validi: ${h.openHour}–${h.closeHour}`);
  }
}

assertValidBusinessHours(DEFAULT_BUSINESS_HOURS);

export function getBusinessHours(): SalonBusinessHours {
  return DEFAULT_BUSINESS_HOURS;
}

/** Ore di inizio di ogni fascia visibile in calendario, es. [8, 9, …, 20]. */
export function getBusinessHourSlots(hours: SalonBusinessHours = getBusinessHours()): number[] {
  return Array.from({ length: hours.closeHour - hours.openHour }, (_, i) => i + hours.openHour);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatHour(hour: number): string {
  return `${pad2(hour)}:00`;
}

interface ZonedParts {
  /** YYYY-MM-DD nel fuso del salone */
  dayKey: string;
  /** minuti trascorsi dalla mezzanotte nel fuso del salone */
  minutes: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    dayKey: `${p.year}-${p.month}-${p.day}`,
    // `% 24`: alcuni motori datati rendono la mezzanotte come "24" anche con h23.
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
  };
}

/**
 * Verifica che l'appuntamento [start, end) cada interamente nell'orario di
 * apertura dello stesso giorno, nel fuso del salone.
 * Ritorna `null` se valido, altrimenti un messaggio d'errore per l'utente.
 */
export function validateWithinBusinessHours(
  start: Date,
  end: Date,
  hours: SalonBusinessHours = getBusinessHours()
): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Data/ora non valida.";
  }
  if (end <= start) return "L'orario di fine deve essere successivo all'inizio.";

  const open = hours.openHour * 60;
  const close = hours.closeHour * 60;
  const s = getZonedParts(start, hours.timeZone);
  const e = getZonedParts(end, hours.timeZone);
  const range = `${formatHour(hours.openHour)} e le ${formatHour(hours.closeHour)}`;

  if (s.minutes < open || s.minutes >= close) {
    return `Gli appuntamenti devono iniziare tra le ${range}.`;
  }
  // Una fine esattamente a mezzanotte (closeHour 24) appare come 00:00 del
  // giorno dopo: la trattiamo come 24:00 del giorno di inizio.
  const endsAtMidnightOfNextDay =
    hours.closeHour === 24 && e.minutes === 0 && end.getTime() - start.getTime() <= 24 * 3600_000;
  const endMinutes = endsAtMidnightOfNextDay ? close : e.minutes;
  if ((!endsAtMidnightOfNextDay && e.dayKey !== s.dayKey) || endMinutes > close) {
    return `Gli appuntamenti devono terminare entro le ${formatHour(hours.closeHour)} dello stesso giorno.`;
  }
  return null;
}

const toMinute = (d: Date) => Math.floor(d.getTime() / 60000);

/**
 * True se i due slot coincidono al minuto (il modale lavora a risoluzione
 * minuto). Serve a non bloccare la modifica di altri campi su appuntamenti
 * storici salvati fuori dall'orario attuale (es. prima di un cambio orari).
 */
export function isSameSlot(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return toMinute(aStart) === toMinute(bStart) && toMinute(aEnd) === toMinute(bEnd);
}

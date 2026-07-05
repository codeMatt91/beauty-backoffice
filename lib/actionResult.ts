import { ZodError } from "zod";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export function zodErrorToMessage(error: ZodError): string {
  return (
    error.issues[0]?.message ??
    "Compila tutti i campi obbligatori correttamente."
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/passwordReset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await requestPasswordReset(email);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-rose-100">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💆</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Password dimenticata?</h1>
          <p className="text-sm text-muted-foreground">
            Inserisci la tua email: se l&apos;account esiste ti invieremo un link per reimpostare la password.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-foreground">
            Se l&apos;indirizzo email è registrato, riceverai a breve un&apos;email con le istruzioni per il reset.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tuamail@email.it"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Invio in corso..." : "Invia link di reset"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * API Route – Data Purge & Archiving
 * POST /api/purge
 * Body: { olderThanMonths: number }
 * Returns: ZIP file stream (blob download)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runPurge } from "@/lib/purge";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  olderThanMonths: z.coerce.number().min(1).max(60),
});

export async function POST(req: NextRequest) {
  // Solo Admin autenticati
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Parametri non validi" }, { status: 400 });
  }

  try {
    const result = await runPurge(body.olderThanMonths);

    return new NextResponse(result.zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.zipBuffer.length.toString(),
        "X-Record-Count": result.recordCount.toString(),
        "X-Date-From": result.dateFrom.toISOString(),
        "X-Date-To": result.dateTo.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[Purge API]", err);
    return NextResponse.json({ error: err.message ?? "Errore interno" }, { status: 500 });
  }
}

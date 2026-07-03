/**
 * Data Purge & Archiving – Script di retention dati
 *
 * Flusso:
 * 1. Legge gli Appointment più vecchi di N mesi
 * 2. Li serializza in JSON strutturato
 * 3. Comprime in ZIP (JSZip)
 * 4. Registra il purge nella tabella PurgeArchive
 * 5. Elimina in sicurezza i record dal DB
 * 6. Restituisce il buffer ZIP per il download
 */

import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { subMonths, startOfDay } from "date-fns";

export interface PurgeResult {
  zipBuffer: Buffer;
  filename: string;
  recordCount: number;
  dateFrom: Date;
  dateTo: Date;
}

export async function runPurge(olderThanMonths: number): Promise<PurgeResult> {
  if (olderThanMonths < 1) {
    throw new Error("Il valore minimo è 1 mese");
  }

  const cutoffDate = startOfDay(subMonths(new Date(), olderThanMonths));

  // 1. Leggi i record obsoleti con le relazioni
  const appointments = await prisma.appointment.findMany({
    where: { startTime: { lt: cutoffDate } },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          age: true,
          notes: true,
        },
      },
      employee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startTime: "asc" },
  });

  if (appointments.length === 0) {
    throw new Error("Nessun record trovato con i criteri specificati");
  }

  const dateFrom = appointments[0].startTime;
  const dateTo = appointments[appointments.length - 1].startTime;

  // 2. Struttura JSON export
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    cutoffDate: cutoffDate.toISOString(),
    totalRecords: appointments.length,
    appointments: appointments.map((a) => ({
      id: a.id,
      serviceType: a.serviceType,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      price: a.price.toString(),
      paymentStatus: a.paymentStatus,
      notes: a.notes,
      customer: a.customer,
      employee: a.employee,
    })),
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);

  // 3. Comprimi in ZIP
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonFilename = `appointments_archive_${timestamp}.json`;
  const zipFilename = `appointments_archive_${timestamp}.zip`;

  zip.file(jsonFilename, jsonString);
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  // 4+5. Transazione atomica: registra e poi elimina — se il delete fallisce il log viene annullato
  const ids = appointments.map((a) => a.id);
  await prisma.$transaction([
    prisma.purgeArchive.create({
      data: {
        filename: zipFilename,
        recordCount: appointments.length,
        dateFrom,
        dateTo,
      },
    }),
    prisma.appointment.deleteMany({ where: { id: { in: ids } } }),
  ]);

  return {
    zipBuffer,
    filename: zipFilename,
    recordCount: appointments.length,
    dateFrom,
    dateTo,
  };
}

export async function getPurgeHistory() {
  return prisma.purgeArchive.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

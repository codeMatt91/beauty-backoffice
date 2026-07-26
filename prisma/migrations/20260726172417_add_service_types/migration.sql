-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_types_name_key" ON "service_types"("name");

-- Seed the 10 service types that were previously hardcoded in
-- components/calendar/AppointmentModal.tsx and app/(dashboard)/finance/page.tsx,
-- so existing behavior is unchanged immediately after this migration runs.
INSERT INTO "service_types" ("id", "name", "created_at") VALUES
  (md5(random()::text || clock_timestamp()::text), 'Pulizia viso', now()),
  (md5(random()::text || clock_timestamp()::text), 'Massaggio rilassante', now()),
  (md5(random()::text || clock_timestamp()::text), 'Trattamento corpo', now()),
  (md5(random()::text || clock_timestamp()::text), 'Manicure', now()),
  (md5(random()::text || clock_timestamp()::text), 'Pedicure', now()),
  (md5(random()::text || clock_timestamp()::text), 'Ceretta', now()),
  (md5(random()::text || clock_timestamp()::text), 'Laser', now()),
  (md5(random()::text || clock_timestamp()::text), 'Radiofrequenza', now()),
  (md5(random()::text || clock_timestamp()::text), 'Pressoterapia', now()),
  (md5(random()::text || clock_timestamp()::text), 'Altro', now())
ON CONFLICT ("name") DO NOTHING;

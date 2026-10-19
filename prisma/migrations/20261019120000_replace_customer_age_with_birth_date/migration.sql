-- Replace "age" with "birth_date" on customers.
-- Idempotent: some environments already received this change via `prisma db push`.
ALTER TABLE "customers" DROP COLUMN IF EXISTS "age";
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "birth_date" DATE;

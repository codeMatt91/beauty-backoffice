-- Step 1: add new columns as nullable
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name"  TEXT;
ALTER TABLE "users" ADD COLUMN "image"      TEXT;

-- Step 2: populate first_name / last_name from existing name
UPDATE "users"
SET
  "first_name" = SPLIT_PART(name, ' ', 1),
  "last_name"  = CASE
    WHEN POSITION(' ' IN name) > 0
    THEN TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1))
    ELSE ''
  END;

-- Step 3: enforce NOT NULL now that rows are populated
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "last_name"  SET NOT NULL;

-- Step 4: drop the old column
ALTER TABLE "users" DROP COLUMN "name";

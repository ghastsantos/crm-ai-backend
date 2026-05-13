ALTER TABLE "Organization" ADD COLUMN     "niche" TEXT;

UPDATE "Organization"
SET "niche" = 'Geral'
WHERE "niche" IS NULL;

ALTER TABLE "Organization" ALTER COLUMN "niche" SET NOT NULL;

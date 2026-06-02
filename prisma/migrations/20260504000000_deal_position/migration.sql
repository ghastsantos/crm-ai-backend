-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill: order by createdAt within each pipeline column
WITH ordered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "pipelineColumnId"
            ORDER BY "createdAt" ASC, id ASC
        ) - 1 AS pos
    FROM "Deal"
)
UPDATE "Deal" d
SET "position" = ordered.pos
FROM ordered
WHERE d.id = ordered.id;

-- CreateIndex
CREATE INDEX "Deal_pipelineColumnId_position_idx" ON "Deal"("pipelineColumnId", "position");

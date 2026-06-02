-- CreateTable
CREATE TABLE "PipelineColumn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineColumn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineColumn_organizationId_idx" ON "PipelineColumn"("organizationId");

-- CreateIndex
CREATE INDEX "PipelineColumn_organizationId_position_idx" ON "PipelineColumn"("organizationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineColumn_organizationId_position_key" ON "PipelineColumn"("organizationId", "position");

-- AddForeignKey
ALTER TABLE "PipelineColumn" ADD CONSTRAINT "PipelineColumn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "pipelineColumnId" TEXT;

-- Data: one default column set per organization
INSERT INTO "PipelineColumn" ("id", "organizationId", "title", "position", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    v.title,
    v.pos,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM "Organization" o
CROSS JOIN (
    VALUES
        (0, 'Lead captado'),
        (1, 'Qualificação (MQL/ICP)'),
        (2, 'Contato inicial'),
        (3, 'Proposta'),
        (4, 'Negociação'),
        (5, 'Fechamento')
) AS v(pos, title);

-- Data: map deals to columns by former enum stage
UPDATE "Deal" d
SET "pipelineColumnId" = pc."id"
FROM "PipelineColumn" pc
WHERE pc."organizationId" = d."organizationId"
  AND pc."position" = (
    CASE d."stage"::text
      WHEN 'LEAD_CAPTADO' THEN 0
      WHEN 'QUALIFICACAO_MQL_ICP' THEN 1
      WHEN 'CONTATO_INICIAL' THEN 2
      WHEN 'PROPOSTA' THEN 3
      WHEN 'NEGOCIACAO' THEN 4
      WHEN 'FECHAMENTO' THEN 5
      ELSE 0
    END
  );

-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "pipelineColumnId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pipelineColumnId_fkey" FOREIGN KEY ("pipelineColumnId") REFERENCES "PipelineColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Deal_pipelineColumnId_idx" ON "Deal"("pipelineColumnId");

-- AlterTable
ALTER TABLE "Deal" DROP COLUMN "stage";

-- DropEnum
DROP TYPE "DealStage";

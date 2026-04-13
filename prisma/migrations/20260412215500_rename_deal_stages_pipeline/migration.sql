-- AlterEnum
-- Replace DealStage enum with pipeline-specific stages.
-- Deal table is empty at migration time, so the USING cast is safe.
BEGIN;
CREATE TYPE "DealStage_new" AS ENUM ('LEAD_CAPTADO', 'QUALIFICACAO_MQL_ICP', 'CONTATO_INICIAL', 'PROPOSTA', 'NEGOCIACAO', 'FECHAMENTO');
ALTER TABLE "Deal" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Deal" ALTER COLUMN "stage" TYPE "DealStage_new" USING (
  CASE "stage"::text
    WHEN 'LEAD' THEN 'LEAD_CAPTADO'
    WHEN 'QUALIFIED' THEN 'QUALIFICACAO_MQL_ICP'
    WHEN 'PROPOSAL' THEN 'PROPOSTA'
    WHEN 'WON' THEN 'FECHAMENTO'
    WHEN 'LOST' THEN 'LEAD_CAPTADO'
    ELSE 'LEAD_CAPTADO'
  END::"DealStage_new"
);
ALTER TYPE "DealStage" RENAME TO "DealStage_old";
ALTER TYPE "DealStage_new" RENAME TO "DealStage";
DROP TYPE "DealStage_old";
ALTER TABLE "Deal" ALTER COLUMN "stage" SET DEFAULT 'LEAD_CAPTADO';
COMMIT;

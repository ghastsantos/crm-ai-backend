-- CreateEnum
CREATE TYPE "PipelineLogAction" AS ENUM ('DEAL_CREATED', 'DEAL_MOVED', 'DEAL_UPDATED', 'DEAL_ARCHIVED', 'DEAL_DELETED', 'OWNER_CHANGED', 'COLUMN_CREATED', 'COLUMN_UPDATED', 'COLUMN_DELETED');

-- DropIndex
DROP INDEX "PipelineColumn_organizationId_position_idx";

-- CreateTable
CREATE TABLE "PipelineLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "dealId" TEXT,
    "action" "PipelineLogAction" NOT NULL,
    "description" TEXT NOT NULL,
    "fromColumnId" TEXT,
    "toColumnId" TEXT,
    "fromColumnName" TEXT,
    "toColumnName" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineLog_organizationId_idx" ON "PipelineLog"("organizationId");

-- CreateIndex
CREATE INDEX "PipelineLog_userId_idx" ON "PipelineLog"("userId");

-- CreateIndex
CREATE INDEX "PipelineLog_dealId_idx" ON "PipelineLog"("dealId");

-- CreateIndex
CREATE INDEX "PipelineLog_action_idx" ON "PipelineLog"("action");

-- CreateIndex
CREATE INDEX "PipelineLog_createdAt_idx" ON "PipelineLog"("createdAt");

-- CreateIndex
CREATE INDEX "PipelineLog_organizationId_createdAt_idx" ON "PipelineLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "PipelineLog" ADD CONSTRAINT "PipelineLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineLog" ADD CONSTRAINT "PipelineLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineLog" ADD CONSTRAINT "PipelineLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineLog" ADD CONSTRAINT "PipelineLog_fromColumnId_fkey" FOREIGN KEY ("fromColumnId") REFERENCES "PipelineColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineLog" ADD CONSTRAINT "PipelineLog_toColumnId_fkey" FOREIGN KEY ("toColumnId") REFERENCES "PipelineColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

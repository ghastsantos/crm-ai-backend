-- CreateTable
CREATE TABLE "AutoriaNote" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "AutoriaNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoriaNote_organizationId_idx" ON "AutoriaNote"("organizationId");

-- AddForeignKey
ALTER TABLE "AutoriaNote" ADD CONSTRAINT "AutoriaNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

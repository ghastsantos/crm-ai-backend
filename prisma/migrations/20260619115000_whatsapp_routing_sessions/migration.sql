CREATE TABLE "WhatsAppRoutingSession" (
    "id" TEXT NOT NULL,
    "connectedPhone" TEXT NOT NULL,
    "leadPhone" TEXT NOT NULL,
    "selectedOrganizationId" TEXT,
    "lastPromptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppRoutingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppRoutingSession_connectedPhone_leadPhone_key"
    ON "WhatsAppRoutingSession"("connectedPhone", "leadPhone");
CREATE INDEX "WhatsAppRoutingSession_selectedOrganizationId_idx"
    ON "WhatsAppRoutingSession"("selectedOrganizationId");
CREATE INDEX "WhatsAppRoutingSession_updatedAt_idx"
    ON "WhatsAppRoutingSession"("updatedAt");

ALTER TABLE "WhatsAppRoutingSession" ADD CONSTRAINT "WhatsAppRoutingSession_selectedOrganizationId_fkey"
    FOREIGN KEY ("selectedOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

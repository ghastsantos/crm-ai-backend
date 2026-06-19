CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED');
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('RECEIVED', 'SENT', 'IGNORED', 'FAILED');

CREATE TABLE "WhatsAppIntegration" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "qrCode" TEXT,
    "pairingCode" TEXT,
    "connectedPhone" TEXT,
    "lastWebhookAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "WhatsAppIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactName" TEXT,
    "dealId" TEXT,
    "stage" TEXT,
    "summary" TEXT,
    "nextStep" TEXT,
    "lastReply" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "externalMessageId" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "phone" TEXT NOT NULL,
    "contactName" TEXT,
    "text" TEXT NOT NULL,
    "analysis" JSONB,
    "responseText" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppIntegration_instanceName_key" ON "WhatsAppIntegration"("instanceName");
CREATE UNIQUE INDEX "WhatsAppIntegration_organizationId_key" ON "WhatsAppIntegration"("organizationId");
CREATE UNIQUE INDEX "WhatsAppConversation_organizationId_phone_key" ON "WhatsAppConversation"("organizationId", "phone");
CREATE UNIQUE INDEX "WhatsAppMessage_externalMessageId_key" ON "WhatsAppMessage"("externalMessageId");
CREATE INDEX "WhatsAppConversation_organizationId_idx" ON "WhatsAppConversation"("organizationId");
CREATE INDEX "WhatsAppConversation_dealId_idx" ON "WhatsAppConversation"("dealId");
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");
CREATE INDEX "WhatsAppMessage_organizationId_idx" ON "WhatsAppMessage"("organizationId");
CREATE INDEX "WhatsAppMessage_conversationId_idx" ON "WhatsAppMessage"("conversationId");
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");

ALTER TABLE "WhatsAppIntegration" ADD CONSTRAINT "WhatsAppIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

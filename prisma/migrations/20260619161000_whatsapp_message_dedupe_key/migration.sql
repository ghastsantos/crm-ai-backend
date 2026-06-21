ALTER TABLE "WhatsAppMessage" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "WhatsAppMessage_dedupeKey_key" ON "WhatsAppMessage"("dedupeKey");

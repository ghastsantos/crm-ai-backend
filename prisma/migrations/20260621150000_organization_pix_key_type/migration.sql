CREATE TYPE "OrganizationPixKeyType" AS ENUM ('CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM');

ALTER TABLE "Organization" ADD COLUMN "pixKeyType" "OrganizationPixKeyType";

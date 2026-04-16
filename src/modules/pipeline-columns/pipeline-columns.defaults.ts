import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const DEFAULT_PIPELINE_COLUMN_SEED = [
  { position: 0, title: 'Lead captado' },
  { position: 1, title: 'Qualificação (MQL/ICP)' },
  { position: 2, title: 'Contato inicial' },
  { position: 3, title: 'Proposta' },
  { position: 4, title: 'Negociação' },
  { position: 5, title: 'Fechamento' },
] as const;

export async function seedDefaultPipelineColumnsForOrganization(
  tx: TransactionClient,
  organizationId: string
): Promise<void> {
  for (const row of DEFAULT_PIPELINE_COLUMN_SEED) {
    await tx.pipelineColumn.create({
      data: {
        organizationId,
        title: row.title,
        position: row.position,
      },
    });
  }
}

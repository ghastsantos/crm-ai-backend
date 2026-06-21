import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const MIN_PIPELINE_COLUMNS = 5;

export const DEFAULT_PIPELINE_COLUMN_SEED = [
  { position: 0, title: 'Lead' },
  { position: 1, title: 'Qualificação' },
  { position: 2, title: 'Em negociação' },
  { position: 3, title: 'Fechamento' },
  { position: 4, title: 'Não fechou' },
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

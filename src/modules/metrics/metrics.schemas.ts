import { z } from 'zod';

const rangeDaysSchema = z.preprocess(
  (value) => (value === undefined ? 30 : Number(value)),
  z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)])
);

export const metricsOverviewQuerySchema = z.object({
  organizationId: z.string().min(1),
  rangeDays: rangeDaysSchema,
});

export type MetricsOverviewQuery = z.infer<typeof metricsOverviewQuerySchema>;

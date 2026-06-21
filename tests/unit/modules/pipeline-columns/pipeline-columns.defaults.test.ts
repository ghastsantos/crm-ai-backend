import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIPELINE_COLUMN_SEED,
  MIN_PIPELINE_COLUMNS,
} from '@/modules/pipeline-columns/pipeline-columns.defaults';

describe('DEFAULT_PIPELINE_COLUMN_SEED', () => {
  it('keeps the CRM pipeline simple enough for the WhatsApp assistant', () => {
    expect(DEFAULT_PIPELINE_COLUMN_SEED).toEqual([
      { position: 0, title: 'Lead' },
      { position: 1, title: 'Qualificação' },
      { position: 2, title: 'Em negociação' },
      { position: 3, title: 'Fechamento' },
      { position: 4, title: 'Não fechou' },
    ]);
    expect(DEFAULT_PIPELINE_COLUMN_SEED).toHaveLength(MIN_PIPELINE_COLUMNS);
  });
});

import { describe, expect, it } from 'vitest';
import { columnForStage } from '@/modules/whatsapp/whatsapp.service';

describe('columnForStage', () => {
  const columns = [
    { id: 'lead', title: 'Lead', position: 0 },
    { id: 'qualificacao', title: 'Qualificação', position: 1 },
    { id: 'negociacao', title: 'Em negociação', position: 2 },
    { id: 'fechamento', title: 'Fechamento', position: 3 },
    { id: 'nao-fechou', title: 'Não fechou', position: 4 },
  ];

  it('uses the matching column title for a stage', () => {
    expect(columnForStage(columns, 'EM_NEGOCIACAO').id).toBe('negociacao');
    expect(columnForStage(columns, 'NAO_FECHOU').id).toBe('nao-fechou');
  });

  it('falls back to the expected stage position', () => {
    const customColumns = [
      { id: 'a', title: 'Entrada', position: 0 },
      { id: 'b', title: 'Diagnóstico', position: 1 },
      { id: 'c', title: 'Proposta comercial', position: 2 },
    ];

    expect(columnForStage(customColumns, 'EM_NEGOCIACAO').id).toBe('c');
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeWhatsAppMessage } from '@/modules/whatsapp/whatsapp-assistant';

describe('analyzeWhatsAppMessage', () => {
  it('moves accepted deals to closing', () => {
    const result = analyzeWhatsAppMessage('Gostei da proposta, pode fechar o contrato.');

    expect(result.stage).toBe('FECHAMENTO');
    expect(result.summary).toContain('cliente aceitou');
  });

  it('marks explicit rejection as lost', () => {
    const result = analyzeWhatsAppMessage('Obrigado, mas não tenho interesse agora.');

    expect(result.stage).toBe('NAO_FECHOU');
    expect(result.summary).toContain('sem interesse');
  });

  it('keeps pricing talks in negotiation', () => {
    const result = analyzeWhatsAppMessage('Consegue melhorar o preço ou dar desconto?');

    expect(result.stage).toBe('EM_NEGOCIACAO');
  });
});

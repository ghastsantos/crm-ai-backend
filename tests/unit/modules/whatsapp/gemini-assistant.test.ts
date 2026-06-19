import { describe, expect, it } from 'vitest';
import { parseGeminiAnalysisText } from '@/modules/whatsapp/gemini-assistant';

describe('parseGeminiAnalysisText', () => {
  it('accepts valid Gemini JSON with CRM actions', () => {
    const analysis = parseGeminiAnalysisText(`
      {
        "stage": "EM_NEGOCIACAO",
        "summary": "Cliente pediu proposta e informou orçamento.",
        "nextStep": "Enviar proposta com condição de pagamento.",
        "suggestedReply": "Posso te mandar uma proposta com as opções.",
        "fields": {
          "contactName": "Ana",
          "companyName": "Ana Ltda",
          "dealValue": 1200,
          "email": "ana@example.com"
        }
      }
    `);

    expect(analysis.stage).toBe('EM_NEGOCIACAO');
    expect(analysis.fields.contactName).toBe('Ana');
    expect(analysis.fields.dealValue).toBe(1200);
  });

  it('accepts JSON wrapped in markdown fences', () => {
    const analysis = parseGeminiAnalysisText(`
      \`\`\`json
      {
        "stage": "FECHAMENTO",
        "summary": "Cliente aceitou fechar.",
        "nextStep": "Confirmar dados finais.",
        "suggestedReply": "Fechado, vou te mandar os próximos passos.",
        "fields": {}
      }
      \`\`\`
    `);

    expect(analysis.stage).toBe('FECHAMENTO');
  });

  it('accepts null optional fields from Gemini JSON', () => {
    const analysis = parseGeminiAnalysisText(`
      {
        "stage": "LEAD",
        "summary": "Cliente iniciou contato.",
        "nextStep": "Apresentar produtos disponiveis.",
        "suggestedReply": "Ola, posso te mostrar as opcoes.",
        "fields": {
          "contactName": null,
          "companyName": null,
          "email": null,
          "dealValue": null
        }
      }
    `);

    expect(analysis.fields).toEqual({});
  });

  it('rejects invalid stage values', () => {
    expect(() =>
      parseGeminiAnalysisText(`
        {
          "stage": "GANHO",
          "summary": "Cliente aceitou fechar.",
          "nextStep": "Confirmar dados finais.",
          "suggestedReply": "Fechado.",
          "fields": {}
        }
      `)
    ).toThrow(/Invalid Gemini analysis/);
  });
});

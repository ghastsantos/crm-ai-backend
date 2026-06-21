import { describe, expect, it } from 'vitest';
import { parseBaileysMessage } from '@/modules/whatsapp/baileys-message';

describe('parseBaileysMessage', () => {
  it('extracts a plain inbound text message from Baileys messages', () => {
    const parsed = parseBaileysMessage(
      {
        key: {
          id: 'ABCD1234',
          fromMe: false,
          remoteJid: '5541999998888@s.whatsapp.net',
        },
        pushName: 'Ana Cliente',
        message: {
          conversation: 'Oi, tenho interesse no servico.',
        },
      },
      'crm-global'
    );

    expect(parsed).toEqual({
      externalMessageId: 'crm-global:ABCD1234',
      instanceName: 'crm-global',
      phone: '5541999998888',
      replyJid: '5541999998888@s.whatsapp.net',
      contactName: 'Ana Cliente',
      text: 'Oi, tenho interesse no servico.',
    });
  });

  it('uses the phone number alt JID when WhatsApp sends an internal LID', () => {
    const parsed = parseBaileysMessage(
      {
        key: {
          id: 'LID123',
          fromMe: false,
          remoteJid: '85130630709368@lid',
          remoteJidAlt: '5541999998888@s.whatsapp.net',
          addressingMode: 'lid',
        },
        pushName: 'Jonas',
        message: {
          conversation: 'Saroba',
        },
      },
      'crm-global'
    );

    expect(parsed).toMatchObject({
      externalMessageId: 'crm-global:LID123',
      phone: '5541999998888',
      replyJid: '85130630709368@lid',
      contactName: 'Jonas',
      text: 'Saroba',
    });
  });

  it('extracts extended text messages', () => {
    const parsed = parseBaileysMessage(
      {
        key: {
          id: 'EXT123',
          fromMe: false,
          remoteJid: '554188887777@s.whatsapp.net',
        },
        message: {
          extendedTextMessage: {
            text: 'Pode fechar a proposta.',
          },
        },
      },
      'crm-global'
    );

    expect(parsed?.text).toBe('Pode fechar a proposta.');
    expect(parsed?.phone).toBe('554188887777');
    expect(parsed?.replyJid).toBe('554188887777@s.whatsapp.net');
  });

  it('turns image messages without caption into a readable inbound event', () => {
    const parsed = parseBaileysMessage(
      {
        key: {
          id: 'IMG123',
          fromMe: false,
          remoteJid: '554188887777@s.whatsapp.net',
        },
        message: {
          imageMessage: {
            mimetype: 'image/jpeg',
          },
        },
      },
      'crm-global'
    );

    expect(parsed).toMatchObject({
      externalMessageId: 'crm-global:IMG123',
      phone: '554188887777',
      text: '[imagem recebida]',
    });
  });

  it('ignores messages sent by the connected account', () => {
    const parsed = parseBaileysMessage(
      {
        key: {
          id: 'FROMME',
          fromMe: true,
          remoteJid: '5541999998888@s.whatsapp.net',
        },
        message: {
          conversation: 'Mensagem do bot.',
        },
      },
      'crm-global'
    );

    expect(parsed).toBeNull();
  });

  it('ignores groups and messages without useful content', () => {
    expect(
      parseBaileysMessage(
        {
          key: {
            id: 'GROUP',
            fromMe: false,
            remoteJid: '120363000000000000@g.us',
          },
          message: {
            conversation: 'Oi grupo.',
          },
        },
        'crm-global'
      )
    ).toBeNull();

    expect(
      parseBaileysMessage(
        {
          key: {
            id: 'EMPTY',
            fromMe: false,
            remoteJid: '5541999998888@s.whatsapp.net',
          },
          message: {
            reactionMessage: {
              text: '👍',
            },
          },
        },
        'crm-global'
      )
    ).toBeNull();
  });

  it('ignores newsletters, status and broadcast messages', () => {
    for (const remoteJid of [
      '120363333110886230@newsletter',
      'status@broadcast',
      '1700000000@broadcast',
    ]) {
      expect(
        parseBaileysMessage(
          {
            key: {
              id: `IGNORED-${remoteJid}`,
              fromMe: false,
              remoteJid,
            },
            message: {
              conversation: 'Promo qualquer',
            },
          },
          'crm-global'
        )
      ).toBeNull();
    }
  });
});

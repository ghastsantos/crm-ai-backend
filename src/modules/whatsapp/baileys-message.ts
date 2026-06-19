export type ParsedBaileysMessage = {
  externalMessageId: string;
  instanceName: string;
  phone: string;
  replyJid: string;
  contactName?: string;
  text: string;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function isIgnoredJid(jid: string): boolean {
  return (
    jid === 'status@broadcast' ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@g.us') ||
    jid.endsWith('@newsletter')
  );
}

function phoneFromJid(jid: string | undefined): string {
  if (!jid) return '';
  return normalizePhone(jid.split('@')[0]?.split(':')[0] ?? '');
}

function unwrapMessage(message: Record<string, unknown>): Record<string, unknown> {
  let current = message;
  for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2']) {
    const wrapper = readRecord(current[key]);
    const nested = readRecord(wrapper?.message);
    if (nested) current = nested;
  }

  const documentWithCaption = readRecord(current.documentWithCaptionMessage);
  const nestedDocument = readRecord(documentWithCaption?.message);
  return nestedDocument ?? current;
}

function readText(message: Record<string, unknown>): string | undefined {
  const unwrapped = unwrapMessage(message);
  const conversation = readString(unwrapped.conversation);
  if (conversation) return conversation;

  const extendedText = readRecord(unwrapped.extendedTextMessage);
  const extended = readString(extendedText?.text);
  if (extended) return extended;

  const image = readRecord(unwrapped.imageMessage);
  const imageCaption = readString(image?.caption);
  if (imageCaption) return imageCaption;

  const video = readRecord(unwrapped.videoMessage);
  const videoCaption = readString(video?.caption);
  if (videoCaption) return videoCaption;

  const button = readRecord(unwrapped.buttonsResponseMessage);
  const buttonText = readString(button?.selectedDisplayText);
  if (buttonText) return buttonText;

  const list = readRecord(unwrapped.listResponseMessage);
  return readString(list?.title);
}

export function parseBaileysMessage(
  messageInfo: unknown,
  instanceName: string
): ParsedBaileysMessage | null {
  const root = readRecord(messageInfo);
  const key = readRecord(root?.key);
  const message = readRecord(root?.message);

  if (!root || !key || !message) return null;
  if (key.fromMe === true) return null;

  const remoteJid = readString(key.remoteJid);
  const remoteJidAlt = readString(key.remoteJidAlt);
  const participantAlt = readString(key.participantAlt);
  const id = readString(key.id);
  const text = readText(message);

  if (!remoteJid || !id || !text) return null;
  if (isIgnoredJid(remoteJid)) return null;

  const phone = phoneFromJid(remoteJidAlt) || phoneFromJid(participantAlt) || phoneFromJid(remoteJid);
  if (phone.length < 8) return null;

  return {
    externalMessageId: `${instanceName}:${id}`,
    instanceName,
    phone,
    replyJid: remoteJid,
    contactName: readString(root.pushName),
    text,
  };
}

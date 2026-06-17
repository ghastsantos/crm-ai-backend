import fs from 'fs/promises';
import path from 'path';
import pino from 'pino';
import QRCode from 'qrcode';
import { WhatsAppConnectionStatus } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { parseBaileysMessage, type ParsedBaileysMessage } from './baileys-message';

type BaileysSocket = {
  ev: {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  sendMessage(jid: string, content: { text: string }): Promise<unknown>;
  end?(error?: Error): void;
  user?: {
    id?: string | null;
  } | null;
};

type BaileysModule = {
  default(config: Record<string, unknown>): BaileysSocket;
  DisconnectReason: {
    loggedOut: number;
    restartRequired: number;
  };
  useMultiFileAuthState(folder: string): Promise<{
    state: unknown;
    saveCreds: () => Promise<void>;
  }>;
};

export type WhatsAppProviderConnectionInfo = {
  status: WhatsAppConnectionStatus;
  qrCode: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
};

type StartProviderOptions = {
  instanceName: string;
  onMessage(message: ParsedBaileysMessage): Promise<void>;
  onConnectionUpdate(info: Partial<WhatsAppProviderConnectionInfo>): Promise<void>;
};

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<unknown>;

const silentLogger = pino({ level: 'silent' });

let socket: BaileysSocket | null = null;
let startPromise: Promise<WhatsAppProviderConnectionInfo> | null = null;
let latestInfo: WhatsAppProviderConnectionInfo = {
  status: WhatsAppConnectionStatus.NOT_CONFIGURED,
  qrCode: null,
  pairingCode: null,
  connectedPhone: null,
};
let lastOptions: StartProviderOptions | null = null;
let socketGeneration = 0;
const waiters = new Set<(info: WhatsAppProviderConnectionInfo) => void>();

function providerEnabled(): boolean {
  return env.WHATSAPP_PROVIDER === 'baileys';
}

function normalizePhone(value: string | null | undefined): string | null {
  const raw = value?.split('@')[0]?.split(':')[0] ?? '';
  const phone = raw.replace(/\D/g, '');
  return phone.length > 0 ? phone : null;
}

function resolveAuthFolder(): string {
  const cwd = path.resolve(process.cwd());
  const authFolder = path.resolve(cwd, env.WHATSAPP_AUTH_DIR);
  const relative = path.relative(cwd, authFolder);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('WHATSAPP_AUTH_DIR must be a folder inside the backend workspace');
  }

  return authFolder;
}

async function importBaileys(): Promise<BaileysModule> {
  return (await dynamicImport('baileys')) as BaileysModule;
}

async function publishInfo(
  options: StartProviderOptions,
  info: Partial<WhatsAppProviderConnectionInfo>
): Promise<void> {
  latestInfo = {
    ...latestInfo,
    ...info,
  };

  waiters.forEach((resolve) => resolve(latestInfo));
  waiters.clear();

  await options.onConnectionUpdate(info).catch((error) => {
    logger.warn({ err: error }, 'Could not persist WhatsApp connection state');
  });
}

function waitForConnectionInfo(timeoutMs: number): Promise<WhatsAppProviderConnectionInfo> {
  if (latestInfo.qrCode || latestInfo.status === WhatsAppConnectionStatus.CONNECTED) {
    return Promise.resolve(latestInfo);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(resolve);
      resolve(latestInfo);
    }, timeoutMs);

    waiters.add((info) => {
      clearTimeout(timer);
      resolve(info);
    });
  });
}

async function createSocket(options: StartProviderOptions): Promise<WhatsAppProviderConnectionInfo> {
  if (!providerEnabled()) {
    latestInfo = {
      status: WhatsAppConnectionStatus.CONNECTING,
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
    };
    return latestInfo;
  }

  const baileys = await importBaileys();
  const authFolder = resolveAuthFolder();
  const { state, saveCreds } = await baileys.useMultiFileAuthState(authFolder);
  const generation = socketGeneration + 1;
  socketGeneration = generation;

  socket = baileys.default({
    auth: state,
    logger: silentLogger,
    browser: ['CRM AI', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  await publishInfo(options, {
    status: WhatsAppConnectionStatus.CONNECTING,
    qrCode: null,
    pairingCode: null,
  });

  socket.ev.on('creds.update', () => {
    void saveCreds();
  });

  socket.ev.on('connection.update', (rawUpdate) => {
    void handleConnectionUpdate(baileys, options, rawUpdate, generation);
  });

  socket.ev.on('messages.upsert', (rawEvent) => {
    void handleMessages(options, rawEvent, generation);
  });

  return latestInfo;
}

async function handleConnectionUpdate(
  baileys: BaileysModule,
  options: StartProviderOptions,
  rawUpdate: unknown,
  generation: number
): Promise<void> {
  if (generation !== socketGeneration) return;

  const update = rawUpdate as {
    connection?: string;
    qr?: string;
    lastDisconnect?: {
      error?: {
        output?: {
          statusCode?: number;
        };
      };
    };
  };

  if (update.qr) {
    await publishInfo(options, {
      status: WhatsAppConnectionStatus.CONNECTING,
      qrCode: await QRCode.toDataURL(update.qr, { margin: 1, scale: 6 }),
      pairingCode: null,
    });
  }

  if (update.connection === 'open') {
    await publishInfo(options, {
      status: WhatsAppConnectionStatus.CONNECTED,
      qrCode: null,
      pairingCode: null,
      connectedPhone: normalizePhone(socket?.user?.id),
    });
    return;
  }

  if (update.connection === 'connecting') {
    await publishInfo(options, { status: WhatsAppConnectionStatus.CONNECTING });
    return;
  }

  if (update.connection !== 'close') return;

  const statusCode = update.lastDisconnect?.error?.output?.statusCode;
  const loggedOut = statusCode === baileys.DisconnectReason.loggedOut;
  socket = null;
  await publishInfo(options, {
    status: WhatsAppConnectionStatus.DISCONNECTED,
    ...(loggedOut ? { qrCode: null, pairingCode: null, connectedPhone: null } : {}),
  });

  if (loggedOut) return;

  setTimeout(() => {
    if (lastOptions) {
      void startBaileysProvider(lastOptions).catch((error) => {
        logger.warn({ err: error }, 'Could not restart WhatsApp provider');
      });
    }
  }, statusCode === baileys.DisconnectReason.restartRequired ? 500 : 2000);
}

async function handleMessages(
  options: StartProviderOptions,
  rawEvent: unknown,
  generation: number
): Promise<void> {
  if (generation !== socketGeneration) return;

  const event = rawEvent as { messages?: unknown[]; type?: string };
  if (!Array.isArray(event.messages)) return;

  for (const rawMessage of event.messages) {
    const message = parseBaileysMessage(rawMessage, options.instanceName);
    if (!message) continue;

    await options.onMessage(message).catch((error) => {
      logger.warn({ err: error, phone: message.phone }, 'Could not process WhatsApp message');
    });
  }
}

export async function startBaileysProvider(
  options: StartProviderOptions
): Promise<WhatsAppProviderConnectionInfo> {
  lastOptions = options;
  if (socket) return latestInfo;
  if (!startPromise) {
    startPromise = createSocket(options).finally(() => {
      startPromise = null;
    });
  }
  return startPromise;
}

export async function connectBaileysProvider(
  options: StartProviderOptions
): Promise<WhatsAppProviderConnectionInfo> {
  await startBaileysProvider(options);
  return waitForConnectionInfo(20000);
}

export function getBaileysProviderInfo(): WhatsAppProviderConnectionInfo {
  return latestInfo;
}

export async function resetBaileysProvider(options?: { clearAuth?: boolean }): Promise<void> {
  const currentSocket = socket;
  socketGeneration += 1;
  socket = null;
  startPromise = null;
  latestInfo = {
    status: WhatsAppConnectionStatus.DISCONNECTED,
    qrCode: null,
    pairingCode: null,
    connectedPhone: null,
  };
  waiters.forEach((resolve) => resolve(latestInfo));
  waiters.clear();

  if (currentSocket) {
    try {
      currentSocket.end?.(new Error('WhatsApp connection reset'));
    } catch (error) {
      logger.warn({ err: error }, 'Could not close WhatsApp socket before reset');
    }
  }

  if (options?.clearAuth) {
    await fs.rm(resolveAuthFolder(), { recursive: true, force: true });
  }
}

function recipientToJid(value: string): string {
  if (value.includes('@')) return value;
  return `${value.replace(/\D/g, '')}@s.whatsapp.net`;
}

export async function sendBaileysText(recipient: string, text: string): Promise<void> {
  if (!providerEnabled()) return;

  if (!socket && lastOptions) {
    await startBaileysProvider(lastOptions);
  }

  if (!socket) {
    throw new Error('WhatsApp provider is not connected');
  }

  await socket.sendMessage(recipientToJid(recipient), { text });
}

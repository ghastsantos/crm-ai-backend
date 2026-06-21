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

type ProviderState = {
  socket: BaileysSocket | null;
  startPromise: Promise<WhatsAppProviderConnectionInfo> | null;
  latestInfo: WhatsAppProviderConnectionInfo;
  lastOptions: StartProviderOptions | null;
  socketGeneration: number;
  waiters: Set<(info: WhatsAppProviderConnectionInfo) => void>;
};

const providerStates = new Map<string, ProviderState>();

function initialProviderInfo(): WhatsAppProviderConnectionInfo {
  return {
    status: WhatsAppConnectionStatus.NOT_CONFIGURED,
    qrCode: null,
    pairingCode: null,
    connectedPhone: null,
  };
}

function getProviderState(instanceName: string): ProviderState {
  const existing = providerStates.get(instanceName);
  if (existing) return existing;

  const created: ProviderState = {
    socket: null,
    startPromise: null,
    latestInfo: initialProviderInfo(),
    lastOptions: null,
    socketGeneration: 0,
    waiters: new Set<(info: WhatsAppProviderConnectionInfo) => void>(),
  };
  providerStates.set(instanceName, created);
  return created;
}

function providerEnabled(): boolean {
  return env.WHATSAPP_PROVIDER === 'baileys';
}

function normalizePhone(value: string | null | undefined): string | null {
  const raw = value?.split('@')[0]?.split(':')[0] ?? '';
  const phone = raw.replace(/\D/g, '');
  return phone.length > 0 ? phone : null;
}

function assertWorkspaceFolder(folder: string): void {
  const cwd = path.resolve(process.cwd());
  const relative = path.relative(cwd, folder);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('WHATSAPP_AUTH_DIR must be a folder inside the backend workspace');
  }
}

function safeInstanceFolderName(instanceName: string): string {
  return instanceName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveAuthFolder(instanceName: string): string {
  const cwd = path.resolve(process.cwd());
  const baseFolder = path.resolve(cwd, env.WHATSAPP_AUTH_DIR);
  assertWorkspaceFolder(baseFolder);

  if (instanceName === env.WHATSAPP_INSTANCE_NAME) {
    return baseFolder;
  }

  const instanceFolder = path.join(
    path.dirname(baseFolder),
    `${path.basename(baseFolder)}-${safeInstanceFolderName(instanceName)}`
  );
  assertWorkspaceFolder(instanceFolder);

  return instanceFolder;
}

async function importBaileys(): Promise<BaileysModule> {
  return (await dynamicImport('baileys')) as BaileysModule;
}

async function publishInfo(
  options: StartProviderOptions,
  info: Partial<WhatsAppProviderConnectionInfo>
): Promise<void> {
  const state = getProviderState(options.instanceName);
  state.latestInfo = {
    ...state.latestInfo,
    ...info,
  };

  state.waiters.forEach((resolve) => resolve(state.latestInfo));
  state.waiters.clear();

  await options.onConnectionUpdate(info).catch((error) => {
    logger.warn({ err: error }, 'Could not persist WhatsApp connection state');
  });
}

function waitForConnectionInfo(
  instanceName: string,
  timeoutMs: number
): Promise<WhatsAppProviderConnectionInfo> {
  const state = getProviderState(instanceName);
  if (state.latestInfo.qrCode || state.latestInfo.status === WhatsAppConnectionStatus.CONNECTED) {
    return Promise.resolve(state.latestInfo);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      state.waiters.delete(resolve);
      resolve(state.latestInfo);
    }, timeoutMs);

    state.waiters.add((info) => {
      clearTimeout(timer);
      resolve(info);
    });
  });
}

async function createSocket(
  options: StartProviderOptions
): Promise<WhatsAppProviderConnectionInfo> {
  const providerState = getProviderState(options.instanceName);

  if (!providerEnabled()) {
    providerState.latestInfo = {
      status: WhatsAppConnectionStatus.CONNECTING,
      qrCode: null,
      pairingCode: null,
      connectedPhone: null,
    };
    return providerState.latestInfo;
  }

  const baileys = await importBaileys();
  const authFolder = resolveAuthFolder(options.instanceName);
  const { state, saveCreds } = await baileys.useMultiFileAuthState(authFolder);
  const generation = providerState.socketGeneration + 1;
  providerState.socketGeneration = generation;

  providerState.socket = baileys.default({
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

  providerState.socket.ev.on('creds.update', () => {
    void saveCreds();
  });

  providerState.socket.ev.on('connection.update', (rawUpdate) => {
    void handleConnectionUpdate(baileys, options, rawUpdate, generation);
  });

  providerState.socket.ev.on('messages.upsert', (rawEvent) => {
    void handleMessages(options, rawEvent, generation);
  });

  return providerState.latestInfo;
}

async function handleConnectionUpdate(
  baileys: BaileysModule,
  options: StartProviderOptions,
  rawUpdate: unknown,
  generation: number
): Promise<void> {
  const state = getProviderState(options.instanceName);
  if (generation !== state.socketGeneration) return;

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
      connectedPhone: normalizePhone(state.socket?.user?.id),
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
  state.socket = null;
  await publishInfo(options, {
    status: WhatsAppConnectionStatus.DISCONNECTED,
    ...(loggedOut ? { qrCode: null, pairingCode: null, connectedPhone: null } : {}),
  });

  if (loggedOut) return;

  setTimeout(
    () => {
      if (state.lastOptions) {
        void startBaileysProvider(state.lastOptions).catch((error) => {
          logger.warn({ err: error }, 'Could not restart WhatsApp provider');
        });
      }
    },
    statusCode === baileys.DisconnectReason.restartRequired ? 500 : 2000
  );
}

async function handleMessages(
  options: StartProviderOptions,
  rawEvent: unknown,
  generation: number
): Promise<void> {
  const state = getProviderState(options.instanceName);
  if (generation !== state.socketGeneration) return;

  const event = rawEvent as { messages?: unknown[]; type?: string };
  if (!Array.isArray(event.messages)) return;

  logger.debug(
    { instanceName: options.instanceName, count: event.messages.length, type: event.type },
    'WhatsApp provider received message event'
  );

  for (const rawMessage of event.messages) {
    const message = parseBaileysMessage(rawMessage, options.instanceName);
    if (!message) {
      logger.debug(
        { instanceName: options.instanceName },
        'WhatsApp provider ignored message event'
      );
      continue;
    }

    await options.onMessage(message).catch((error) => {
      logger.warn({ err: error, phone: message.phone }, 'Could not process WhatsApp message');
    });
  }
}

export async function startBaileysProvider(
  options: StartProviderOptions
): Promise<WhatsAppProviderConnectionInfo> {
  const state = getProviderState(options.instanceName);
  state.lastOptions = options;
  if (state.socket) return state.latestInfo;
  if (!state.startPromise) {
    state.startPromise = createSocket(options).finally(() => {
      state.startPromise = null;
    });
  }
  return state.startPromise;
}

export async function connectBaileysProvider(
  options: StartProviderOptions
): Promise<WhatsAppProviderConnectionInfo> {
  await startBaileysProvider(options);
  return waitForConnectionInfo(options.instanceName, 20000);
}

export function getBaileysProviderInfo(instanceName: string): WhatsAppProviderConnectionInfo {
  return getProviderState(instanceName).latestInfo;
}

export async function resetBaileysProvider(
  instanceName: string,
  options?: { clearAuth?: boolean }
): Promise<void> {
  const state = getProviderState(instanceName);
  const currentSocket = state.socket;
  state.socketGeneration += 1;
  state.socket = null;
  state.startPromise = null;
  state.latestInfo = {
    status: WhatsAppConnectionStatus.DISCONNECTED,
    qrCode: null,
    pairingCode: null,
    connectedPhone: null,
  };
  state.waiters.forEach((resolve) => resolve(state.latestInfo));
  state.waiters.clear();

  if (currentSocket) {
    try {
      currentSocket.end?.(new Error('WhatsApp connection reset'));
    } catch (error) {
      logger.warn({ err: error }, 'Could not close WhatsApp socket before reset');
    }
  }

  if (options?.clearAuth) {
    await fs.rm(resolveAuthFolder(instanceName), { recursive: true, force: true });
  }
}

function recipientToJid(value: string): string {
  if (value.includes('@')) return value;
  return `${value.replace(/\D/g, '')}@s.whatsapp.net`;
}

export async function sendBaileysText(
  instanceName: string,
  recipient: string,
  text: string
): Promise<void> {
  if (!providerEnabled()) return;

  const state = getProviderState(instanceName);

  if (!state.socket && state.lastOptions) {
    await startBaileysProvider(state.lastOptions);
  }

  if (!state.socket) {
    throw new Error('WhatsApp provider is not connected');
  }

  await state.socket.sendMessage(recipientToJid(recipient), { text });
}

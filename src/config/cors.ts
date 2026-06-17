export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  nodeEnv: string
): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return nodeEnv !== 'production' && isLocalDevelopmentOrigin(origin);
}

export interface TestResponse {
  ok: boolean;
  timestamp: string;
}

export function getTestResponse(): TestResponse {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
  };
}

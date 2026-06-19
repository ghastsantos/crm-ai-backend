import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const { createDevCommand, normalizePortInput, readPort } = require('../../../scripts/dev-port.cjs') as {
  createDevCommand: () => { command: string; args: string[] };
  normalizePortInput: (input: string, fallback: number) => number | null;
  readPort: (value: string | undefined, fallback: number) => number;
};

describe('dev port helper', () => {
  it('uses the suggested fallback when the answer is empty', () => {
    expect(normalizePortInput('', 3001)).toBe(3001);
  });

  it('accepts a valid custom port', () => {
    expect(normalizePortInput('5001', 3001)).toBe(5001);
  });

  it('rejects invalid ports', () => {
    expect(normalizePortInput('abc', 3001)).toBeNull();
    expect(normalizePortInput('0', 3001)).toBeNull();
    expect(normalizePortInput('70000', 3001)).toBeNull();
  });

  it('reads a valid default port from environment values', () => {
    expect(readPort('5050', 3000)).toBe(5050);
    expect(readPort(undefined, 3000)).toBe(3000);
    expect(readPort('wrong', 3000)).toBe(3000);
  });

  it('runs the local cli through node instead of npm.cmd', () => {
    const command = createDevCommand();

    expect(command.command).toBe(process.execPath);
    expect(command.args.join(' ')).toContain('ts-node-dev');
    expect(command.args.join(' ')).not.toContain('npm.cmd');
  });
});

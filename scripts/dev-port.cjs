const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

function normalizePortInput(input, fallback) {
  const value = String(input).trim();

  if (!value) {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

function readPort(value, fallback) {
  return normalizePortInput(value ?? '', fallback) ?? fallback;
}

function readEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const separator = trimmed.indexOf('=');

      if (separator === -1) {
        return env;
      }

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

function readDefaultPort(names, fallback) {
  const localEnv = readEnvFile('.env.local');
  const env = readEnvFile('.env');

  for (const name of names) {
    if (process.env[name]) {
      return readPort(process.env[name], fallback);
    }

    if (localEnv[name]) {
      return readPort(localEnv[name], fallback);
    }

    if (env[name]) {
      return readPort(env[name], fallback);
    }
  }

  return fallback;
}

function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

function createQuestion() {
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask(question) {
      return new Promise((resolve) => prompt.question(question, resolve));
    },
    close() {
      prompt.close();
    },
  };
}

async function choosePort(defaultPort, host = '127.0.0.1') {
  let port = defaultPort;

  while (!(await isPortAvailable(port, host))) {
    if (!process.stdin.isTTY) {
      throw new Error(`Porta ${port} ocupada. Informe outra porta com PORT=xxxx.`);
    }

    const fallback = port < 65535 ? port + 1 : 1;
    const prompt = createQuestion();
    const answer = await prompt.ask(
      `Porta ${port} em uso. Digite outra porta (Enter para ${fallback}, q para cancelar): `
    );
    prompt.close();

    if (answer.trim().toLowerCase() === 'q') {
      process.exit(1);
    }

    const nextPort = normalizePortInput(answer, fallback);

    if (nextPort === null) {
      console.log('Porta invalida. Use um numero entre 1 e 65535.');
      continue;
    }

    port = nextPort;
  }

  return port;
}

function createDevCommand() {
  return {
    command: process.execPath,
    args: [
      path.resolve(process.cwd(), 'node_modules', 'ts-node-dev', 'lib', 'bin.js'),
      '--respawn',
      '--transpile-only',
      '-r',
      'tsconfig-paths/register',
      'src/server.ts',
    ],
  };
}

function runDev(port) {
  const devCommand = createDevCommand();
  const child = spawn(devCommand.command, devCommand.args, {
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    console.error(`Nao foi possivel iniciar o servidor: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

async function main() {
  const host = process.env.HOST || '127.0.0.1';
  const defaultPort = readDefaultPort(['PORT'], 3000);
  const port = await choosePort(defaultPort, host);

  console.log(`Backend usando http://${host}:${port}`);
  runDev(port);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  choosePort,
  createDevCommand,
  isPortAvailable,
  normalizePortInput,
  readDefaultPort,
  readPort,
};

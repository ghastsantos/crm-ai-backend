/* eslint-disable no-console -- CLI: saída para o utilizador */
/**
 * Valida padrões de arquitetura, escrita e segurança alinhados a `.cursor/rules/`
 * (project-standards, api-modules, shared-infra, prisma-database).
 *
 * Regras de negócio em si (invariantes do domínio) exigem testes; aqui validamos
 * a estrutura e convenções que as suportam (módulos, Prisma, env, API, Swagger).
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');
const MODULES_DIR = path.join(SRC_DIR, 'modules');
const APP_TS = path.join(SRC_DIR, 'app.ts');
const PRISMA_CLIENT_FILE = path.join(SRC_DIR, 'infrastructure', 'database', 'prisma.ts');
const ENV_FILE = path.join(SRC_DIR, 'config', 'env.ts');
const ERROR_HANDLER_FILE = path.join(SRC_DIR, 'shared', 'middlewares', 'errorHandler.ts');

const ALLOW_PROCESS_ENV_FILES = new Set([
  path.normalize(ENV_FILE),
  path.normalize(PRISMA_CLIENT_FILE),
]);

interface ValidationError {
  rule: string;
  message: string;
  file?: string;
}

const errors: ValidationError[] = [];

function addError(rule: string, message: string, file?: string): void {
  errors.push({ rule, message, file });
}

function walkTsFiles(dir: string, visitor: (fullPath: string, relPath: string) => void): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist'].includes(entry.name)) {
        walkTsFiles(fullPath, visitor);
      }
      continue;
    }
    if (entry.name.endsWith('.ts')) {
      visitor(fullPath, path.relative(process.cwd(), fullPath));
    }
  }
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

/** project-standards + api-modules: módulo com routes, controller, service */
function checkModuleStructure(): void {
  if (!fs.existsSync(MODULES_DIR)) return;

  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const moduleName of modules) {
    const modulePath = path.join(MODULES_DIR, moduleName);
    const files = fs.readdirSync(modulePath);

    if (!/^[a-z][a-z0-9-]*$/.test(moduleName)) {
      addError(
        'MODULE_NAME',
        `Nome da pasta do módulo "${moduleName}" deve ser kebab-case / minúsculo (project-standards)`,
        modulePath
      );
    }

    const hasRoutes = files.some((f) => f === `${moduleName}.routes.ts`);
    const hasController = files.some((f) => f === `${moduleName}.controller.ts`);
    const hasService = files.some((f) => f === `${moduleName}.service.ts`);

    if (!hasRoutes) {
      addError(
        'MODULE_STRUCTURE',
        `Módulo "${moduleName}" deve ter ${moduleName}.routes.ts (api-modules)`,
        path.join(modulePath, `${moduleName}.routes.ts`)
      );
    }
    if (!hasController) {
      addError(
        'MODULE_STRUCTURE',
        `Módulo "${moduleName}" deve ter ${moduleName}.controller.ts (api-modules)`,
        path.join(modulePath, `${moduleName}.controller.ts`)
      );
    }
    if (!hasService) {
      addError(
        'MODULE_STRUCTURE',
        `Módulo "${moduleName}" deve ter ${moduleName}.service.ts (api-modules)`,
        path.join(modulePath, `${moduleName}.service.ts`)
      );
    }

    for (const f of files) {
      if (!f.endsWith('.ts')) continue;
      if (!/^[a-z][a-z0-9.-]*\.ts$/.test(f)) {
        addError(
          'FILE_NAMING',
          `Ficheiro "${f}" em modules deve usar kebab-case (project-standards)`,
          path.join(modulePath, f)
        );
      }
    }
  }
}

/** project-standards: logging */
function checkNoConsoleLog(dir: string): void {
  walkTsFiles(dir, (fullPath) => {
    const content = read(fullPath);
    if (/console\.(log|error|warn)\s*\(/.test(content)) {
      addError(
        'NO_CONSOLE',
        'Use logger de @/config/logger (project-standards)',
        fullPath
      );
    }
  });
}

/** project-standards: path aliases em módulos */
function checkRelativeImportsInModules(): void {
  if (!fs.existsSync(MODULES_DIR)) return;

  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const moduleName of modules) {
    const modulePath = path.join(MODULES_DIR, moduleName);
    const files = fs.readdirSync(modulePath).filter((f) => f.endsWith('.ts'));

    for (const file of files) {
      const fullPath = path.join(modulePath, file);
      const content = read(fullPath);
      if (/from\s+['"]\.\.\/\.\.\//.test(content)) {
        addError(
          'USE_PATH_ALIASES',
          'Importações fora do módulo devem usar @/ (project-standards)',
          fullPath
        );
      }
    }
  }
}

/** api-modules: rotas em app com /api/v1/<nome> */
function checkAppRegistersModules(): void {
  if (!fs.existsSync(APP_TS) || !fs.existsSync(MODULES_DIR)) return;

  const appContent = read(APP_TS);
  const registered = new Set<string>();
  const re = /app\.use\s*\(\s*['"]\/api\/v1\/([a-z0-9-]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(appContent)) !== null) {
    registered.add(m[1]);
  }

  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const name of modules) {
    if (!registered.has(name)) {
      addError(
        'APP_REGISTRATION',
        `Módulo "${name}" existe em src/modules mas não está registado em app.ts como app.use('/api/v1/${name}', ...) (api-modules / project-standards)`,
        APP_TS
      );
    }
  }
}

/** shared-infra: errorHandler como último app.use */
function checkErrorHandlerLast(): void {
  if (!fs.existsSync(APP_TS)) return;
  const lines = read(APP_TS).split('\n');
  const useLines: { line: number; text: string }[] = [];
  lines.forEach((text, i) => {
    const t = text.trim();
    if (t.startsWith('app.use(') && !t.startsWith('//')) {
      useLines.push({ line: i + 1, text: t });
    }
  });
  if (useLines.length === 0) return;
  const last = useLines[useLines.length - 1];
  if (!last.text.includes('errorHandler')) {
    addError(
      'ERROR_HANDLER_ORDER',
      'errorHandler deve ser o último app.use() em app.ts (shared-infra)',
      APP_TS
    );
  }
}

/** prisma-database: singleton */
function checkPrismaSingleton(): void {
  walkTsFiles(SRC_DIR, (fullPath) => {
    const norm = path.normalize(fullPath);
    if (norm === path.normalize(PRISMA_CLIENT_FILE)) return;
    const content = read(fullPath);
    if (/\bnew\s+PrismaClient\s*\(/.test(content)) {
      addError(
        'PRISMA_SINGLETON',
        'Instanciar PrismaClient só em infrastructure/database/prisma.ts (prisma-database)',
        fullPath
      );
    }
  });
}

/** project-standards + segurança: env centralizado */
function checkNoDirectProcessEnv(): void {
  walkTsFiles(SRC_DIR, (fullPath) => {
    const norm = path.normalize(fullPath);
    if (ALLOW_PROCESS_ENV_FILES.has(norm)) return;
    const content = read(fullPath);
    if (/\bprocess\.env\b/.test(content)) {
      addError(
        'ENV_CENTRALIZED',
        'Use @/config/env em vez de process.env direto (project-standards / segurança)',
        fullPath
      );
    }
  });
}

/** project-standards: evitar any explícito */
function checkNoExplicitAny(): void {
  walkTsFiles(SRC_DIR, (fullPath) => {
    const content = read(fullPath);
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (/\bas any\b/.test(line) || /:\s*any(?:\s*[,;|)\]}]|$)/.test(line)) {
        addError(
          'NO_EXPLICIT_ANY',
          `Evitar "any" / "as any" (project-standards), linha ${i + 1}`,
          fullPath
        );
      }
    });
  });
}

/** project-standards: sem emojis no código */
function checkNoEmojisInCode(): void {
  const emojiRe = /\p{Extended_Pictographic}/u;
  walkTsFiles(SRC_DIR, (fullPath) => {
    const lines = read(fullPath).split('\n');
    lines.forEach((line, i) => {
      if (emojiRe.test(line)) {
        addError(
          'NO_EMOJI',
          `Sem emojis no código (project-standards), linha ${i + 1}`,
          fullPath
        );
      }
    });
  });
}

/** api-modules: documentação OpenAPI nas routes */
function checkRoutesHaveOpenapi(): void {
  if (!fs.existsSync(MODULES_DIR)) return;
  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const moduleName of modules) {
    const routesFile = path.join(MODULES_DIR, moduleName, `${moduleName}.routes.ts`);
    if (!fs.existsSync(routesFile)) continue;
    const content = read(routesFile);
    if (!content.includes('@openapi')) {
      addError(
        'OPENAPI_ROUTES',
        `${moduleName}.routes.ts deve incluir blocos @openapi por endpoint (api-modules)`,
        routesFile
      );
    }
  }
}

/** project-standards: respostas JSON com success em controllers */
function checkControllerResponseShape(): void {
  if (!fs.existsSync(MODULES_DIR)) return;
  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const moduleName of modules) {
    const ctrl = path.join(MODULES_DIR, moduleName, `${moduleName}.controller.ts`);
    if (!fs.existsSync(ctrl)) continue;
    const content = read(ctrl);
    const jsonCallRe = /\.json\s*\(\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = jsonCallRe.exec(content)) !== null) {
      const start = m.index;
      const snippet = content.slice(start, Math.min(content.length, start + 400));
      if (!snippet.includes('success')) {
        addError(
          'API_RESPONSE_SHAPE',
          'Respostas JSON devem incluir { success, ... } (project-standards)',
          ctrl
        );
        break;
      }
    }
  }
}

/** prisma-database: services que usam prisma importam o singleton */
function checkServicePrismaImport(): void {
  if (!fs.existsSync(MODULES_DIR)) return;
  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const moduleName of modules) {
    const svcPath = path.join(MODULES_DIR, moduleName, `${moduleName}.service.ts`);
    if (!fs.existsSync(svcPath)) continue;
    const content = read(svcPath);
    if (!/\bprisma\b/.test(content) && !/\$transaction/.test(content) && !/\$queryRaw/.test(content)) {
      continue;
    }
    if (!content.includes("@/infrastructure/database/prisma")) {
      addError(
        'SERVICE_PRISMA_IMPORT',
        'Service que usa prisma deve importar de @/infrastructure/database/prisma (prisma-database)',
        svcPath
      );
    }
  }
}

/** shared-infra: formato de erro do errorHandler */
function checkErrorHandlerShape(): void {
  if (!fs.existsSync(ERROR_HANDLER_FILE)) return;
  const content = read(ERROR_HANDLER_FILE);
  const hasSuccessFalse = content.includes('success: false');
  const hasErrorBlock = /error:\s*\{[^}]*code:/s.test(content);
  if (!hasSuccessFalse || !hasErrorBlock) {
    addError(
      'ERROR_HANDLER_SHAPE',
      'errorHandler deve responder com { success: false, error: { code, message } } (shared-infra)',
      ERROR_HANDLER_FILE
    );
  }
}

console.log('[validate-standards] A verificar .cursor/rules (project-standards, api-modules, shared-infra, prisma-database)...\n');

checkModuleStructure();
checkNoConsoleLog(SRC_DIR);
checkRelativeImportsInModules();
checkAppRegistersModules();
checkErrorHandlerLast();
checkPrismaSingleton();
checkNoDirectProcessEnv();
checkNoExplicitAny();
checkNoEmojisInCode();
checkRoutesHaveOpenapi();
checkControllerResponseShape();
checkServicePrismaImport();
checkErrorHandlerShape();

if (errors.length > 0) {
  console.error('[validate-standards] Violações:\n');
  for (const err of errors) {
    console.error(`  [${err.rule}] ${err.message}`);
    if (err.file) {
      console.error(`    → ${path.relative(process.cwd(), err.file)}`);
    }
    console.error('');
  }
  console.error('Corrija as violações acima (ver .cursor/rules/).\n');
  process.exit(1);
}

console.log('[validate-standards] Padrões do projeto validados com sucesso.');
process.exit(0);

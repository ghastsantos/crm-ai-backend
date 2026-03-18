/**
 * Valida que o código segue os padrões do projeto.
 * Usado no CI para bloquear PRs que desviam das convenções.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');
const MODULES_DIR = path.join(SRC_DIR, 'modules');

interface ValidationError {
  rule: string;
  message: string;
  file?: string;
}

const errors: ValidationError[] = [];

function addError(rule: string, message: string, file?: string): void {
  errors.push({ rule, message, file });
}

function checkModuleStructure(): void {
  if (!fs.existsSync(MODULES_DIR)) return;

  const modules = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const moduleName of modules) {
    const modulePath = path.join(MODULES_DIR, moduleName);
    const files = fs.readdirSync(modulePath);

    const hasRoutes = files.some((f) => f.endsWith('.routes.ts'));
    const hasController = files.some((f) => f.endsWith('.controller.ts'));
    const hasService = files.some((f) => f.endsWith('.service.ts'));

    if (!hasRoutes) {
      addError(
        'MODULE_STRUCTURE',
        `Módulo "${moduleName}" deve ter arquivo *.routes.ts`,
        path.join(modulePath, `${moduleName}.routes.ts`)
      );
    }
    if (!hasController) {
      addError(
        'MODULE_STRUCTURE',
        `Módulo "${moduleName}" deve ter arquivo *.controller.ts`,
        path.join(modulePath, `${moduleName}.controller.ts`)
      );
    }
    if (!hasService) {
      addError(
        'MODULE_STRUCTURE',
        `Módulo "${moduleName}" deve ter arquivo *.service.ts`,
        path.join(modulePath, `${moduleName}.service.ts`)
      );
    }
  }
}

function checkNoConsoleLog(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!['node_modules', 'dist'].includes(entry.name)) {
        checkNoConsoleLog(fullPath);
      }
      continue;
    }

    if (!entry.name.endsWith('.ts')) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    if (content.includes('console.log') || content.includes('console.error') || content.includes('console.warn')) {
      addError(
        'NO_CONSOLE',
        'Use logger de @/config/logger em vez de console.log/error/warn',
        fullPath
      );
    }
  }
}

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
      const content = fs.readFileSync(fullPath, 'utf-8');

      const badRelativeImports = content.match(/from ['"]\.\.\/\.\.\//g);
      if (badRelativeImports) {
        addError(
          'USE_PATH_ALIASES',
          'Importações externas ao módulo devem usar aliases (@/config, @/shared, etc.)',
          fullPath
        );
      }
    }
  }
}

checkModuleStructure();
checkNoConsoleLog(SRC_DIR);
checkRelativeImportsInModules();

if (errors.length > 0) {
  console.error('\n[validate-standards] Violações dos padrões do projeto:\n');
  for (const err of errors) {
    console.error(`  ${err.rule}: ${err.message}`);
    if (err.file) {
      console.error(`    Arquivo: ${path.relative(process.cwd(), err.file)}`);
    }
    console.error('');
  }
  console.error('Corrija as violações acima antes de fazer push.\n');
  process.exit(1);
}

console.log('[validate-standards] Padrões do projeto validados com sucesso.');
process.exit(0);

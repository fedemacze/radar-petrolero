import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const checks = [];
checks.push(['Node.js 22 o superior', Number(process.versions.node.split('.')[0]) >= 22]);
checks.push(['Dependencias instaladas', existsSync('node_modules/typescript/bin/tsc')]);
checks.push(['Tablas incluidas en la compilación', existsSync('dist/src/db/migration.sql')]);
const config = resolve('.env.local');
checks.push(['Configuración privada local', existsSync(config)]);
if (existsSync(config)) {
  try {
    process.loadEnvFile(config);
    for (const key of ['DATABASE_URL', 'OPENAI_API_KEY', 'ATTIO_API_KEY']) {
      checks.push([`${key} configurada`, Boolean(process.env[key]?.trim())]);
    }
    checks.push(['Simulación activada', process.env.DRY_RUN === 'true']);
  } catch {
    checks.push(['Configuración legible', false]);
  }
}
const ignore = spawnSync('git', ['check-ignore', '-q', '.env.local'], { cwd: root, stdio: 'ignore' });
checks.push(['Configuración excluida de Git', ignore.status === 0]);
for (const [label, ok] of checks) console.log(`${ok ? 'OK' : 'PENDIENTE'}: ${label}`);
console.log('No se muestran claves ni contraseñas. No se realizan llamadas de IA ni escrituras en Attio.');
process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;

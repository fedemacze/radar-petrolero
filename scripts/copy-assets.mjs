import { copyFile, mkdir } from 'node:fs/promises';
const destination = new URL('../dist/src/db/', import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(new URL('../src/db/migration.sql', import.meta.url), new URL('migration.sql', destination));

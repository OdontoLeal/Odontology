// src/shared/infrastructure/database/migrate.ts
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Ejecutor de migraciones versionadas (T-3, DEF-27).
 *
 * `database/migrations/*.sql` es la única fuente de verdad del esquema: la
 * misma secuencia se aplica en una BD local vacía y en producción. Cada
 * archivo se aplica una sola vez, dentro de una transacción, y queda
 * registrado en `public.schema_migrations`.
 *
 * Uso:
 *   npm run db:migrate              -> BD local (DATABASE_URL o DB_*)
 *   npm run db:migrate -- --force   -> requerido si la BD es remota/producción
 *   npm run db:migrate -- --status  -> solo muestra qué falta aplicar
 */
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'database/migrations');

function isRemoteConnection(connectionString: string): boolean {
  return (
    /amazonaws\.com|herokuapp\.com|rds\./i.test(connectionString) ||
    process.env.NODE_ENV === 'production'
  );
}

function buildPool(): Pool {
  const connectionString = process.env.DATABASE_URL || '';
  const useSsl = process.env.DB_SSL === 'true' || isRemoteConnection(connectionString);
  return new Pool({
    connectionString: connectionString || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'odontoleal',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`No existe la carpeta de migraciones: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
}

export async function runMigrations(options: { dryRun?: boolean } = {}): Promise<string[]> {
  const pool = buildPool();
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        nombre      varchar(200) PRIMARY KEY,
        aplicada_en timestamptz  NOT NULL DEFAULT now()
      );
    `);

    const done = new Set(
      (await client.query<{ nombre: string }>('SELECT nombre FROM public.schema_migrations;')).rows.map(
        (r) => r.nombre
      )
    );

    for (const file of listMigrationFiles()) {
      if (done.has(file)) continue;

      if (options.dryRun) {
        applied.push(file);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`→ Aplicando ${file}...`);
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL TIME ZONE 'America/Bogota';");
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (nombre) VALUES ($1);', [file]);
        await client.query('COMMIT');
        applied.push(file);
        console.log(`✔ ${file} aplicada.`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${file}: ${(error as Error).message}`, { cause: error });
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  return applied;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || '';
  const force = process.argv.includes('--force');
  const statusOnly = process.argv.includes('--status');

  if (isRemoteConnection(connectionString) && !force && !statusOnly) {
    console.warn(
      'Se detectó una BD remota/producción. Para aplicar las migraciones ejecute: npm run db:migrate -- --force'
    );
    process.exit(1);
  }

  const result = await runMigrations({ dryRun: statusOnly });
  if (statusOnly) {
    console.log(result.length ? `Pendientes: ${result.join(', ')}` : 'No hay migraciones pendientes.');
  } else {
    console.log(result.length ? `Migraciones aplicadas: ${result.length}` : 'El esquema ya estaba al día.');
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

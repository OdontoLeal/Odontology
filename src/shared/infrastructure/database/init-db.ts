// src/shared/infrastructure/database/init-db.ts
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script de inicialización de esquema de base de datos PostgreSQL (DEF-27).
 * Carga y ejecuta `database/schema.sql`.
 * 
 * NOTA DE SEGURIDAD:
 * Protegido contra ejecuciones accidentales sobre bases de datos remotas/producción.
 */
async function initializeDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || '';
  const isRemoteOrProd =
    connectionString.includes('amazonaws.com') ||
    connectionString.includes('herokuapp.com') ||
    process.env.NODE_ENV === 'production';

  const isForce = process.argv.includes('--force') || process.env.ALLOW_DB_INIT === 'true';

  if (isRemoteOrProd && !isForce) {
    console.warn('\n================================================================');
    console.warn('⚠️  PROTECCIÓN DE SEGURIDAD ACTIVADA');
    console.warn('================================================================');
    console.warn('Se detectó una cadena de conexión a base de datos remota / producción.');
    console.warn('Para evitar modificaciones sobre la BD de producción de OdontoLeal,');
    console.warn('la ejecución automática de "npm run db:init" se encuentra deshabilitada.');
    console.warn('');
    console.warn('Para ejecutarlo en un entorno aislado (ej. PostgreSQL local o Docker):');
    console.warn('  1. Configure DATABASE_URL local en su archivo .env (ej. postgres://localhost:5432/odonto)');
    console.warn('  2. O si explícitamente desea ejecutarlo: npm run db:init -- --force');
    console.warn('================================================================\n');
    process.exit(0);
  }

  const schemaPath = path.resolve(process.cwd(), 'database/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No se encontró el archivo de esquema DDL en: ${schemaPath}`);
  }

  const ddlSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('--- Iniciando inicialización de esquema de Base de Datos OdontoLeal ---');
  console.log(`Leyendo DDL desde: ${schemaPath}`);

  const pool = new Pool({
    connectionString: connectionString || undefined,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'odontoleal',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: isRemoteOrProd ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(ddlSql);
    await client.query('COMMIT');

    console.log('✅ Esquema DDL inicializado exitosamente.');
    console.log('Las tablas relacionales, llaves primarias, foráneas e índices han sido creados (IF NOT EXISTS).');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error al inicializar el esquema de base de datos:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initializeDatabase().catch((err) => {
    console.error('Fallo no controlado en init-db:', err);
    process.exit(1);
  });
}

export { initializeDatabase };

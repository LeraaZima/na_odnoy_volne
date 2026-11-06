import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool, withTransaction } from '../src/db.js';

// Одна транзакция и блокировка защищают от частичного и одновременного запуска.
try {
  await withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(723941)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const directory = new URL('../sql/', import.meta.url);
    const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Изменена уже применённая миграция ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name, checksum) VALUES($1,$2)', [name, checksum]);
      console.log(`Применена миграция ${name}`);
    }
  });
} catch (error) {
  console.error('Не удалось применить миграции:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

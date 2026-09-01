import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

await client.connect();
try {
  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  const vector = await client.query(
    "select exists(select 1 from pg_extension where extname = 'vector') as enabled",
  );
  console.log(JSON.stringify({
    tables: tables.rows.map((row) => row.table_name),
    pgvector: vector.rows[0].enabled,
  }));
} finally {
  await client.end();
}

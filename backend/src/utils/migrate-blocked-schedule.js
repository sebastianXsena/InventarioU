const db = require('../config/database');

async function migrate() {
  try {
    console.log('[MIGRATE] Adding laboratories.blocked_schedule (if missing)...');
    await db.query("ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS blocked_schedule JSONB NOT NULL DEFAULT '[]'::jsonb");
    console.log('[MIGRATE] Done');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Error:', err.message);
    process.exit(1);
  }
}

migrate();

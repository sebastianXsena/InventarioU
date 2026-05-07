const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('[INIT] Creating database schema...');
    await db.query(schema);
    console.log('[INIT] Schema created successfully');

    console.log('[INIT] Database initialization complete');
    process.exit(0);
  } catch (error) {
    console.error('[INIT] Error:', error.message);
    process.exit(1);
  }
}

initDatabase();

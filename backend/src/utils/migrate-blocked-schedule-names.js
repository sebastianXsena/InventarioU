const db = require('../config/database');

async function migrate() {
  try {
    console.log('[MIGRATE] Normalizing laboratories.blocked_schedule entries (ensure name exists)...');

    // Ensure every object element in the array has a "name" key; preserve existing names.
    await db.query(`
      UPDATE laboratories
      SET blocked_schedule = COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(elem) = 'object' THEN
                CASE
                  WHEN elem ? 'name' THEN elem
                  ELSE elem || jsonb_build_object('name', '')
                END
              ELSE elem
            END
          )
          FROM jsonb_array_elements(blocked_schedule) AS elem
        ),
        '[]'::jsonb
      )
    `);

    console.log('[MIGRATE] Done');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATE] Error:', err.message);
    process.exit(1);
  }
}

migrate();

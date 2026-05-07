const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seedDatabase() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    console.log('[SEED] Creating users...');
    const adminHash = await bcrypt.hash('admin123', 12);
    const studentHash = await bcrypt.hash('student123', 12);

    await client.query('DELETE FROM reservation_items');
    await client.query('DELETE FROM reservations');
    await client.query('DELETE FROM items');
    await client.query('DELETE FROM laboratories');
    await client.query('DELETE FROM users');

    const admin = await client.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Admin User', 'admin@lab.com', adminHash, 'admin']
    );

    const student1 = await client.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Ana Garcia', 'ana@lab.com', studentHash, 'student']
    );

    const student2 = await client.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Carlos Lopez', 'carlos@lab.com', studentHash, 'student']
    );

    console.log('[SEED] Creating laboratories...');
    const lab1 = await client.query(
      "INSERT INTO laboratories (name, location, capacity, status) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Lab A - Programacion', 'Edificio 1, Piso 2', 30, 'active']
    );

    const lab2 = await client.query(
      "INSERT INTO laboratories (name, location, capacity, status) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Lab B - Redes', 'Edificio 2, Piso 1', 25, 'active']
    );

    const lab3 = await client.query(
      "INSERT INTO laboratories (name, location, capacity, status) VALUES ($1, $2, $3, $4) RETURNING id",
      ['Lab C - Electronica', 'Edificio 3, Piso 1', 20, 'active']
    );

    console.log('[SEED] Creating items...');
    const items = [
      ['Computadora Desktop', 'PC con monitor 24"', 30, lab1.rows[0].id],
      ['Teclado Mecanico', 'Teclado gaming RGB', 30, lab1.rows[0].id],
      ['Mouse Inalambrico', 'Mouse optico USB', 30, lab1.rows[0].id],
      ['Switch Cisco', 'Switch 24 puertos Gigabit', 5, lab2.rows[0].id],
      ['Router Mikrotik', 'Router configurable', 5, lab2.rows[0].id],
      ['Cable UTP Cat6', 'Rollo 100m cable red', 10, lab2.rows[0].id],
      ['Osciloscopio', 'Osciloscopio digital 100MHz', 8, lab3.rows[0].id],
      ['Protoboard', 'Placa de prototipos', 20, lab3.rows[0].id],
      ['Multimetro Digital', 'Multimetro automatico', 10, lab3.rows[0].id],
      ['Kit Arduino Uno', 'Kit completo Arduino con sensores', 15, lab3.rows[0].id],
    ];

    for (const [name, desc, stock, labId] of items) {
      await client.query(
        "INSERT INTO items (name, description, total_stock, available_stock, lab_id) VALUES ($1, $2, $3, $3, $4)",
        [name, desc, stock, labId]
      );
    }

    console.log('[SEED] Creating sample reservations...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startDate1 = new Date(tomorrow);
    startDate1.setHours(9, 0, 0, 0);
    const endDate1 = new Date(tomorrow);
    endDate1.setHours(11, 0, 0, 0);

    const startDate2 = new Date(tomorrow);
    startDate2.setHours(14, 0, 0, 0);
    const endDate2 = new Date(tomorrow);
    endDate2.setHours(16, 0, 0, 0);

    const startDate3 = new Date(tomorrow);
    startDate3.setDate(startDate3.getDate() + 1);
    startDate3.setHours(10, 0, 0, 0);
    const endDate3 = new Date(startDate3);
    endDate3.setHours(12, 0, 0, 0);

    const res1 = await client.query(
      "INSERT INTO reservations (user_id, lab_id, start_time, end_time, status, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [student1.rows[0].id, lab1.rows[0].id, startDate1, endDate1, 'approved', 'Practica de Python']
    );

    const res2 = await client.query(
      "INSERT INTO reservations (user_id, lab_id, start_time, end_time, status, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [student2.rows[0].id, lab2.rows[0].id, startDate2, endDate2, 'approved', 'Configuracion de VLANs']
    );

    const res3 = await client.query(
      "INSERT INTO reservations (user_id, lab_id, start_time, end_time, status, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [student1.rows[0].id, lab3.rows[0].id, startDate3, endDate3, 'pending', 'Proyecto de sensores']
    );

    console.log('[SEED] Creating reservation items...');
    await client.query(
      "INSERT INTO reservation_items (reservation_id, item_id, quantity_used) VALUES ($1, $2, $3), ($1, $4, $5)",
      [res1.rows[0].id,
        (await client.query("SELECT id FROM items WHERE name = 'Computadora Desktop'"))?.rows[0].id, 5,
        (await client.query("SELECT id FROM items WHERE name = 'Teclado Mecanico'"))?.rows[0].id, 5]
    );

    await client.query(
      "INSERT INTO reservation_items (reservation_id, item_id, quantity_used) VALUES ($1, $2, $3), ($1, $4, $5)",
      [res2.rows[0].id,
        (await client.query("SELECT id FROM items WHERE name = 'Switch Cisco'"))?.rows[0].id, 2,
        (await client.query("SELECT id FROM items WHERE name = 'Cable UTP Cat6'"))?.rows[0].id, 3]
    );

    await client.query(
      "INSERT INTO reservation_items (reservation_id, item_id, quantity_used) VALUES ($1, $2, $3), ($1, $4, $5)",
      [res3.rows[0].id,
        (await client.query("SELECT id FROM items WHERE name = 'Osciloscopio'"))?.rows[0].id, 2,
        (await client.query("SELECT id FROM items WHERE name = 'Kit Arduino Uno'"))?.rows[0].id, 4]
    );

    await client.query(
      "UPDATE items SET available_stock = available_stock - 5 WHERE name = 'Computadora Desktop'"
    );
    await client.query(
      "UPDATE items SET available_stock = available_stock - 5 WHERE name = 'Teclado Mecanico'"
    );
    await client.query(
      "UPDATE items SET available_stock = available_stock - 2 WHERE name = 'Switch Cisco'"
    );
    await client.query(
      "UPDATE items SET available_stock = available_stock - 3 WHERE name = 'Cable UTP Cat6'"
    );

    await client.query('COMMIT');
    console.log('[SEED] Database seeded successfully');
    console.log('\n[SEED] Demo credentials:');
    console.log('  Admin:    admin@lab.com / admin123');
    console.log('  Student:  ana@lab.com / student123');
    console.log('  Student:  carlos@lab.com / student123\n');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SEED] Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

seedDatabase();

import { Router } from 'express';
import pool from '../db.js';
import { encryptRow, decryptRow } from '../crypto-fields.js';

const router = Router();

// ---------------------------------------------------------------------------
// rowToOrder — converts a decrypted DB row to the API response shape.
// Decryption happens before this function is called.
// ---------------------------------------------------------------------------
function rowToOrder(row) {
  return {
    id:                  row.id,
    number:              row.number,
    createdAt:           row.created_at,
    arrivalAt:           row.arrival_at,
    updatedAt:           row.updated_at,
    operator:            row.operator,
    status:              row.status,
    completed:           row.status === 'complete',
    completedAt:         row.completed_at,
    customer: {
      name:    row.cust_name,
      surname: row.cust_surname,
      country: row.cust_country,
      idType:  row.cust_id_type,
      idCode:  row.cust_id_code,
      address: row.cust_address,
      phone:   row.cust_phone,
    },
    route:               row.route,
    adults:              row.adults,
    kids:                row.kids,
    lines:               row.lines,
    manualAdjustment:    parseFloat(row.manual_adjustment),
    manualTotalOverride: row.manual_total_override != null
                           ? parseFloat(row.manual_total_override) : null,
    notes:               row.notes,
  };
}

// ---------------------------------------------------------------------------
// GET /api/orders — all orders, decrypted
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY number DESC');
    res.json(rows.map(row => rowToOrder(decryptRow(row))));
  } catch (err) {
    console.error('GET /api/orders:', err);
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/next-number
// ---------------------------------------------------------------------------
router.get('/next-number', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT last_value + 1 AS next FROM order_number_seq');
    res.json({ nextNumber: rows[0].next });
  } catch (err) {
    console.error('GET /api/orders/next-number:', err);
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders — create, encrypt PII before insert
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  const { id, arrivalAt, operator, customer, route, adults, kids,
          lines, manualAdjustment, manualTotalOverride, notes } = req.body;

  if (!id || !arrivalAt || !customer?.name || !customer?.surname) {
    return res.status(400).json({
      error: 'Chýbajú povinné polia (id, arrivalAt, customer.name, customer.surname)',
    });
  }

  // Build a flat row object with the PII fields, then encrypt them.
  const plainRow = {
    cust_name:    customer.name,
    cust_surname: customer.surname,
    cust_id_code: customer.idCode    || '',
    cust_address: customer.address   || '',
    cust_phone:   customer.phone     || '',
  };
  const enc = encryptRow(plainRow);

  try {
    const { rows } = await pool.query(
      `INSERT INTO orders
         (id, arrival_at, operator, cust_name, cust_surname, cust_country,
          cust_id_type, cust_id_code, cust_address, cust_phone,
          route, adults, kids, lines, manual_adjustment, manual_total_override, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        id, arrivalAt, operator || '',
        enc.cust_name, enc.cust_surname, customer.country || '',
        customer.idType || 'ID', enc.cust_id_code,
        enc.cust_address, enc.cust_phone,
        route || '', adults || 0, kids || 0,
        JSON.stringify(lines || []),
        manualAdjustment || 0,
        manualTotalOverride != null ? manualTotalOverride : null,
        notes || '',
      ]
    );
    res.status(201).json(rowToOrder(decryptRow(rows[0])));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Objednávka s týmto ID už existuje' });
    }
    console.error('POST /api/orders:', err);
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/orders/:id — full update, encrypt PII before write
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const { arrivalAt, operator, customer, route, adults, kids,
          lines, manualAdjustment, manualTotalOverride, notes } = req.body;

  const plainRow = {
    cust_name:    customer.name,
    cust_surname: customer.surname,
    cust_id_code: customer.idCode    || '',
    cust_address: customer.address   || '',
    cust_phone:   customer.phone     || '',
  };
  const enc = encryptRow(plainRow);

  try {
    const { rows } = await pool.query(
      `UPDATE orders SET
         arrival_at=$1, operator=$2,
         cust_name=$3, cust_surname=$4, cust_country=$5,
         cust_id_type=$6, cust_id_code=$7, cust_address=$8, cust_phone=$9,
         route=$10, adults=$11, kids=$12,
         lines=$13, manual_adjustment=$14, manual_total_override=$15,
         notes=$16, updated_at=NOW()
       WHERE id=$17
       RETURNING *`,
      [
        arrivalAt, operator || '',
        enc.cust_name, enc.cust_surname, customer.country || '',
        customer.idType || 'ID', enc.cust_id_code,
        enc.cust_address, enc.cust_phone,
        route || '', adults || 0, kids || 0,
        JSON.stringify(lines || []),
        manualAdjustment || 0,
        manualTotalOverride != null ? manualTotalOverride : null,
        notes || '',
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Objednávka nenájdená' });
    res.json(rowToOrder(decryptRow(rows[0])));
  } catch (err) {
    console.error('PUT /api/orders/:id:', err);
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/orders/:id/status — no PII involved, no change needed
// ---------------------------------------------------------------------------
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (status !== 'pending' && status !== 'complete') {
    return res.status(400).json({ error: 'Status musí byť "pending" alebo "complete"' });
  }
  const completedAt = status === 'complete' ? new Date().toISOString() : null;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET status=$1, completed_at=$2 WHERE id=$3
       RETURNING id, status, completed_at`,
      [status, completedAt, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Objednávka nenájdená' });
    res.json({
      id:          rows[0].id,
      status:      rows[0].status,
      completed:   rows[0].status === 'complete',
      completedAt: rows[0].completed_at,
    });
  } catch (err) {
    console.error('PATCH /api/orders/:id/status:', err);
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/orders/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /api/orders/:id:', err);
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

export default router;

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const { json } = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(json());

// Setup SQLite DB
const db = new sqlite3.Database('./licenses.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      key TEXT PRIMARY KEY,
      deviceId TEXT
    )
  `);
});

// Supabase client
const supabase = createClient(
  'https://efshqfhgxlaaogibtufh.supabase.co',      // Replace with your Supabase URL
  process.env.SUPABASE_SERVICE_ROLE                // Replace with your Supabase service role key (store in env var in prod!)
);

// -----------------------------
// ROUTES
// -----------------------------

// 🔐 Activate license
app.post('/activate', (req, res) => {
  const { key, deviceId } = req.body;
  db.run(
    `INSERT OR REPLACE INTO licenses (key, deviceId) VALUES (?, ?)`,
    [key, deviceId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Validate license
app.post('/validate', (req, res) => {
  const { key, deviceId } = req.body;
  db.get(
    `SELECT * FROM licenses WHERE key = ? AND deviceId = ?`,
    [key, deviceId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ valid: !!row });
    }
  );
});

// Check license by device ID (SQLite)
app.get('/status/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  db.get(
    `SELECT * FROM licenses WHERE deviceId = ?`,
    [deviceId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ licensed: !!row });
    }
  );
});

// Check license using Supabase
app.get('/check', async (req, res) => {
  const deviceId = req.query.deviceId;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }

  try {
    const { data, error } = await supabase
      .from('license_keys')
      .select('key')
      .eq('used_by', deviceId)
      .eq('is_used', true)
      .maybeSingle();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ licensed: !!data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`License API running on http://localhost:${PORT}`);
});

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./licenses.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      key TEXT PRIMARY KEY,
      deviceId TEXT
    )
  `);
});

// Activate license
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

// Check license by device ID (SQLite-based)
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

// Supabase-powered check (optional advanced endpoint)
app.get('/check', async (req, res) => {
  const deviceId = req.query.deviceId;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }

  try {
    const response = await fetch('https://efshqfhgxlaaogibtufh.supabase.co/rest/v1/license_keys?select=key&used_by=eq.' + deviceId + '&is_used=eq.true', {
      headers: {
        apikey: process.env.SUPABASE_API_KEY,
        Authorization: 'Bearer ${process.env.SUPABASE_BEARER_TOKEN}'
      }
    });

    const data = await response.json();
    const licensed = Array.isArray(data) && data.length > 0;

    res.json({ licensed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`License API running on http://localhost:${PORT}`);
});

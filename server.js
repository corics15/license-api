// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
import cors from 'cors';
const app = express();
const PORT = 3000;

app.use(cors());
app.use(json());

// Set up SQLite DB
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
      if (row) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false });
      }
    }
  );
});

// Check license by device ID
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

    if (data) {
      return res.json({ licensed: true });
    } else {
      return res.json({ licensed: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => {
  console.log(`License API running on http://localhost:${PORT}`);
});

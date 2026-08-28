const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/db' });
const app = express();
app.use(express.json());

app.post('/events', async (req, res) => {
    const { entity_id, event_type, payload, schema_version } = req.body;
    
    // We must use a transaction to lock the entity's ledger to ensure sequential hashes
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Lock the entity to prevent race conditions during hash chaining
        // In a real system, we'd lock a snapshot or entity table. Here we use an advisory lock or pg_advisory_xact_lock
        const hashInt = crypto.createHash('md5').update(entity_id).digest('readInt32BE', 0);
        await client.query('SELECT pg_advisory_xact_lock($1)', [hashInt]);

        const lastEventRes = await client.query('SELECT hash FROM event_ledger WHERE entity_id = $1 ORDER BY id DESC LIMIT 1', [entity_id]);
        const previous_hash = lastEventRes.rows.length > 0 ? lastEventRes.rows[0].hash : 'GENESIS';

        const eventDataString = JSON.stringify({ entity_id, event_type, payload, schema_version, previous_hash });
        const current_hash = crypto.createHash('sha256').update(eventDataString).digest('hex');

        await client.query(
            `INSERT INTO event_ledger (entity_id, event_type, payload, schema_version, previous_hash, hash) VALUES ($1, $2, $3, $4, $5, $6)`,
            [entity_id, event_type, JSON.stringify(payload), schema_version, previous_hash, current_hash]
        );
        
        await client.query('COMMIT');

        // Async projection update (could be Kafka/triggers in prod)
        updateSnapshot(entity_id).catch(console.error);

        res.send({ status: 'appended', hash: current_hash });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).send({ error: err.message });
    } finally {
        client.release();
    }
});

async function updateSnapshot(entity_id) {
    const events = await pool.query('SELECT * FROM event_ledger WHERE entity_id = $1 ORDER BY id ASC', [entity_id]);
    let currentState = {};
    for (let row of events.rows) {
        if (row.event_type === 'USER_CREATED') currentState = { ...row.payload };
        if (row.event_type === 'EMAIL_UPDATED') currentState.email = row.payload.email;
    }
    await pool.query('INSERT INTO projection_cache (entity_id, state) VALUES ($1, $2) ON CONFLICT (entity_id) DO UPDATE SET state = $2', [entity_id, JSON.stringify(currentState)]);
}

if (require.main === module) {
    app.listen(3000, () => console.log('Audit Log running on 3000'));
}

module.exports = { app, pool, updateSnapshot };

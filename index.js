const express = require('express');
const { Pool } = require('pg');
const pool = new Pool();
const app = express();
app.use(express.json());

app.post('/events', async (req, res) => {
    const { entity_id, event_type, payload, schema_version } = req.body;
    // Append-only ledger
    await pool.query(`INSERT INTO event_ledger (entity_id, event_type, payload, schema_version) VALUES ($1, $2, $3, $4)`,
        [entity_id, event_type, JSON.stringify(payload), schema_version]);
    
    // Async projection update (could be Kafka/triggers in prod)
    updateSnapshot(entity_id);
    res.send({ status: 'appended' });
});

async function updateSnapshot(entity_id) {
    const events = await pool.query('SELECT * FROM event_ledger WHERE entity_id = $1 ORDER BY created_at ASC', [entity_id]);
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

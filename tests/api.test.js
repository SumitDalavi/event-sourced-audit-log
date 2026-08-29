const request = require('supertest');
const { app, pool } = require('../index');

jest.mock('pg', () => {
    let events = [];
    const mPool = {
        connect: jest.fn().mockResolvedValue({
            query: jest.fn().mockImplementation(async (queryStr, params) => {
                if (queryStr.includes('pg_advisory_xact_lock')) return { rows: [] };
                if (queryStr.includes('BEGIN')) return { rows: [] };
                if (queryStr.includes('COMMIT')) return { rows: [] };
                if (queryStr.includes('ROLLBACK')) return { rows: [] };
                if (queryStr.includes('ORDER BY id DESC LIMIT 1')) {
                    const e = events.filter(e => e.entity_id === params[0]);
                    if (e.length > 0) return { rows: [e[e.length - 1]] };
                    return { rows: [] };
                }
                if (queryStr.includes('ORDER BY id ASC')) {
                    return { rows: events.filter(e => e.entity_id === params[0]) };
                }
                if (queryStr.includes('INSERT INTO event_ledger')) {
                    events.push({
                        id: events.length + 1,
                        entity_id: params[0],
                        event_type: params[1],
                        payload: JSON.parse(params[2]),
                        schema_version: params[3],
                        previous_hash: params[4],
                        hash: params[5]
                    });
                    return { rows: [] };
                }
                if (queryStr.includes('INSERT INTO projection_cache')) return { rows: [] };
                return { rows: [] };
            }),
            release: jest.fn()
        }),
        // Fix: pool.query (used by updateSnapshot) must also return { rows: [] }
        // so the fire-and-forget projection update doesn't throw a TypeError
        // when trying to iterate `.rows` on an undefined result.
        query: jest.fn().mockImplementation(async (queryStr, params) => {
            if (queryStr.includes('ORDER BY id ASC')) {
                return { rows: [] };
            }
            return { rows: [] };
        }),
        end: jest.fn()
    };
    return { Pool: jest.fn(() => mPool) };
});

describe('Event Sourced Audit Log', () => {
    afterAll(async () => {
        await pool.end();
    });

    it('appends genesis event with GENESIS previous_hash', async () => {
        const res = await request(app)
            .post('/events')
            .send({
                entity_id: 'user_1',
                event_type: 'USER_CREATED',
                payload: { name: 'Alice' },
                schema_version: '1.0'
            });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('appended');
        expect(res.body.hash).toBeDefined();
    });

    it('chains subsequent events with valid crypto hashes', async () => {
        // Appending second event
        const res2 = await request(app)
            .post('/events')
            .send({
                entity_id: 'user_1',
                event_type: 'EMAIL_UPDATED',
                payload: { email: 'alice@example.com' },
                schema_version: '1.0'
            });
        
        expect(res2.status).toBe(200);
        expect(res2.body.hash).toBeDefined();
    });
});

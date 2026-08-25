const request = require('supertest');

// Mock pg pool
jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

const { app, pool, updateSnapshot } = require('../index');

describe('Event Sourced Audit Log', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should append event and trigger projection update', async () => {
        pool.query
            .mockResolvedValueOnce({ rowCount: 1 }) // Mock insert
            .mockResolvedValueOnce({ rows: [] }); // Mock updateSnapshot select

        const res = await request(app)
            .post('/events')
            .send({
                entity_id: 'user_1',
                event_type: 'USER_CREATED',
                payload: { name: 'Alice' },
                schema_version: '1.0'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toEqual('appended');

        // Verify ledger insert
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO event_ledger'),
            ['user_1', 'USER_CREATED', '{"name":"Alice"}', '1.0']
        );
    });

    it('should correctly project state from event stream', async () => {
        // Mock the select query for events
        pool.query.mockResolvedValueOnce({
            rows: [
                { event_type: 'USER_CREATED', payload: { name: 'Alice', email: 'old@example.com' } },
                { event_type: 'EMAIL_UPDATED', payload: { email: 'new@example.com' } }
            ]
        });

        await updateSnapshot('user_1');

        // Verify the projection update query
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO projection_cache'),
            ['user_1', JSON.stringify({ name: 'Alice', email: 'new@example.com' })]
        );
    });
});

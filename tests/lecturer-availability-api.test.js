const request = require('supertest');
const express = require('express');

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'ok' }));

// Test‑only stubs
app.get('/api/availability', (req, res) => {
  const email = req.headers['x-lecturer-email'];
  if (!email) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ defaultDuration: 30, weeklySchedule: [] });
});

app.post('/api/availability', (req, res) => {
  const { defaultDuration, weeklySchedule } = req.body;
  if (!defaultDuration || !Array.isArray(weeklySchedule)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  res.json({
    message: 'Availability saved',
    data: { defaultDuration, weeklySchedule }
  });
});

describe('Lecturer Availability API', () => {
  it('should reject if X-Lecturer-Email is missing', async () => {
    const response = await request(app).get('/api/availability');
    expect(response.status).toBe(401);
  });

  it('should save valid availability', async () => {
    const response = await request(app)
      .post('/api/availability')
      .set('X-Lecturer-Email', 'test@example.com')
      .send({ defaultDuration: 30, weeklySchedule: [] });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Availability saved');
  });
});
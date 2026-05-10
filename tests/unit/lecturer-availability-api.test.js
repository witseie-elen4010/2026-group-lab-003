const request = require('supertest');
const express = require('express');

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.json({ status: 'ok' }));

// Test‑only stubs
app.get('/api/availability', (req, res) => {
  const id = req.headers['x-lecturer-id'];
  if (!id) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ lecturerName: 'Test Lecturer', weeklySchedule: [] });
});

app.post('/api/availability', (req, res) => {
  const { weeklySchedule } = req.body;
  if (!Array.isArray(weeklySchedule)) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  res.json({
    message: 'Availability saved',
    data: { weeklySchedule }
  });
});

describe('Lecturer Availability API', () => {
  it('should reject if X-Lecturer-Id is missing', async () => {
    const response = await request(app).get('/api/availability');
    expect(response.status).toBe(401);
  });

  it('should save valid availability', async () => {
    const response = await request(app)
      .post('/api/availability')
      .set('X-Lecturer-Id', 'test@example.com')
      .set('X-Lecturer-Name', 'Test Lecturer')
      .send({ weeklySchedule: [] });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Availability saved');
  });
});
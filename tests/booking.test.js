// tests/booking.test.js
const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/booking');

// Mock the Booking model so we can control database responses during tests
jest.mock('../src/models/booking', () => ({
  countDocuments: jest.fn()
}));

describe('Booking Validation Middleware', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test 1: Missing Data
    it('should reject if required fields are missing', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                startTime: "10:00",
                date: "2026-05-10"
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("Missing required fields");
    });

    // Test 2: Bad Format (e.g., someone typing "potato" instead of a time)
    it('should reject invalid time formats', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                date: "2026-05-10",
                startTime: "potato",
                endTime: "11:00"
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("Invalid time format");
    });

    // Test 3: Time Traveler (End time is before start time)
    it('should reject if end time is before start time', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                date: "2026-05-10",
                startTime: "14:00",
                endTime: "10:00"
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("end time must be after the start time");
    });

    // Test 4: Max Capacity Check
    it('should reject if the consultation is at max capacity', async () => {
        // Mock: the slot already has 5 students booked (at capacity)
        Booking.countDocuments.mockResolvedValue(5);

        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                date: "2026-05-10",
                startTime: "10:00",
                endTime: "11:00"
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("maximum capacity");
    });

    // Test 5: Daily Limit Check
    it('should reject if the lecturer has reached their daily limit', async () => {
        // Mock: slot has 0 students (under capacity, passes), but lecturer has 10 daily bookings (at daily limit)
        Booking.countDocuments
            .mockResolvedValueOnce(0)   // First call: capacity check → 0 < 5, passes
            .mockResolvedValueOnce(10); // Second call: daily limit check → 10 >= 10, triggers

        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                date: "2026-05-10",
                startTime: "10:00",
                endTime: "11:00"
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("daily limit");
    });

});
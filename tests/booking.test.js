// tests/booking.test.js
const request = require('supertest');
const app = require('../src/app'); // We import your Express app to test it

describe('Booking Validation Middleware', () => {

    // Test 1: The "Happy Path" (Valid Time)
    it('should accept a booking within valid hours (10:00 - 11:00)', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                startTime: "10:00",
                endTime: "11:00"
            });

        // We expect the bouncer to let this through (Status 200)
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Validation passed! Booking is ready to be saved to the database.");
    });

    // Test 2: The "Sad Path" (Too Late)
    it('should reject a booking that is too late (18:00 - 19:00)', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                startTime: "18:00",
                endTime: "19:00"
            });

        // We expect the bouncer to block this (Status 400)
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("Booking rejected");
    });

    // Test 3: The "Sad Path" (Too Early)
    it('should reject a booking that is too early (07:00 - 08:00)', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                startTime: "07:00",
                endTime: "08:00"
            });

        // We expect the bouncer to block this too
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
    });

});
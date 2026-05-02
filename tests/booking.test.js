// tests/booking.test.js
const request = require('supertest');
const app = require('../src/app'); 

describe('Booking Validation Middleware', () => {

    // Test 1: Missing Data
    it('should reject if required fields are missing', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                startTime: "10:00" 
                
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
                startTime: "14:00",
                endTime: "10:00" 
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("end time must be after the start time");
    });

    it('should reject if the consultation is at max capacity', async () => {
        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: "123",
                startTime: "10:00", 
                endTime: "11:00"   
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("maximum capacity");
    });

});
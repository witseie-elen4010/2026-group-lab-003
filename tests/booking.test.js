// tests/booking.test.js
const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/booking');

// Mock the Booking model so we can control database responses during tests
jest.mock('../src/models/booking', () => ({
  countDocuments: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
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

    // Test 2: Bad Format
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

    // Test 3: Time Traveler
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
        Booking.countDocuments
            .mockResolvedValueOnce(0)   
            .mockResolvedValueOnce(10); 

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

  
    describe('DELETE /api/bookings/:id', () => {
        
        // Test 6: Successful Cancellation
        it('should allow the organizer to cancel their booking', async () => {
            const mockBooking = { _id: 'sess_123', studentId: 'organizer@wits.ac.za' };
            
            Booking.findById.mockResolvedValue(mockBooking);
            Booking.findByIdAndUpdate.mockResolvedValue(true);

            const response = await request(app)
                .delete('/api/bookings/sess_123')
                .send({ studentEmail: 'organizer@wits.ac.za' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('successfully canceled');
        });

        // Test 7: Unauthorized Cancellation
        it('should block a different student from canceling the booking', async () => {
            const mockBooking = { _id: 'sess_123', studentId: 'organizer@wits.ac.za' };
            
            Booking.findById.mockResolvedValue(mockBooking);

            const response = await request(app)
                .delete('/api/bookings/sess_123')
                .send({ studentEmail: 'intruder@student.wits.ac.za' });

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Unauthorized');
        });

        // Test 404: Non-existent booking
        it('should return 404 if the booking does not exist', async () => {
            Booking.findById.mockResolvedValue(null);

            const response = await request(app)
                .delete('/api/bookings/missing_id')
                .send({ studentEmail: 'test@student.wits.ac.za' });

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });
});
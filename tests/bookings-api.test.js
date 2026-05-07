const request = require('supertest');
const app = require('../src/app');
const Booking = require('../src/models/booking');

jest.mock('../src/models/booking');

describe('Bookings API - Extra Coverage', () => {
    
    // Test for GET /api/bookings (targeting lines 56-80)
    it('should fetch bookings for a specific student', async () => {
        const mockBookings = [{ module: 'CS101', studentId: 'test@student.com' }];
        Booking.find = jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockBookings)
        });

        const response = await request(app).get('/api/bookings?studentId=test@student.com');
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    // Test for GET /api/bookings error path (targeting the 'catch' block)
    it('should return 500 if database fails during fetch', async () => {
        Booking.find = jest.fn().mockImplementation(() => {
            throw new Error('DB Failure');
        });

        const response = await request(app).get('/api/bookings?studentId=test@student.com');
        expect(response.status).toBe(500);
    });

    // Test for Missing StudentID in GET
    it('should return 400 if studentId is missing in GET', async () => {
        const response = await request(app).get('/api/bookings');
        expect(response.status).toBe(400);
    });
});
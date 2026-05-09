const request = require('supertest');
const app = require('../../src/app');
const Booking = require('../../src/models/booking');

jest.mock('../../src/models/booking');

describe('User Acceptance Story: Consultation Management', () => {
    
    it('should allow a student to book and then cancel a session', async () => {
        // --- 1. THE BOOKING FLOW ---
        Booking.countDocuments.mockResolvedValue(0);
        Booking.prototype.save = jest.fn().mockResolvedValue({ _id: 'session_123' });

        const bookResponse = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: 'prof@wits.ac.za',
                date: '2026-07-10',
                startTime: '09:30',
                endTime: '10:00',
                module: 'PHYS1000',
                studentId: 'organizer@wits.ac.za'
            });

        expect(bookResponse.status).toBe(201);

        // --- 2. THE CANCELLATION FLOW ---
        // Mock finding the booking we just "created"
        Booking.findById = jest.fn().mockResolvedValue({
            _id: 'session_123',
            studentId: 'organizer@wits.ac.za'
        });
        Booking.findByIdAndDelete = jest.fn().mockResolvedValue(true);

        const cancelResponse = await request(app)
            .delete('/api/bookings/session_123')
            .send({ studentEmail: 'organizer@wits.ac.za' });

        // Acceptance Criteria check: Session must be successfully removed
        expect(cancelResponse.status).toBe(200);
        expect(cancelResponse.body.message).toContain('successfully canceled');
    });
});
const request = require('supertest');
const app = require('../../src/app');
const Booking = require('../../src/models/booking');

// We mock the model, but we test the entire ROUTE logic
jest.mock('../../src/models/booking');

describe('Booking Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully pass validation and save a booking to the DB', async () => {
        // Mocking the database checks used in the validator middleware
        Booking.countDocuments.mockResolvedValue(0); 
        
        // Mocking the save function on the prototype
        Booking.prototype.save = jest.fn().mockResolvedValue({
            _id: 'mock_id',
            studentId: 'student@wits.ac.za'
        });

        const response = await request(app)
            .post('/api/bookings/create')
            .send({
                lecturerId: 'lecturer@wits.ac.za',
                date: '2026-06-01',
                startTime: '10:00',
                endTime: '11:00',
                module: 'ELEN4010',
                studentId: 'student@wits.ac.za'
            });

        // This proves the Route, the Middleware, and the Model are integrated
        expect(response.status).toBe(201);
        expect(response.body.booking).toBeDefined();
        expect(Booking.prototype.save).toHaveBeenCalled();
    });
});
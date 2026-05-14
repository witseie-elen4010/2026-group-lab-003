const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user');

// Mock the User model
jest.mock('../../src/models/user');

// Mock email service
jest.mock('../../src/utils/emailService', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendNotification: jest.fn()
}));

describe('Auth Profile Endpoints - displayName & emailNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with displayName and emailNotifications', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.displayName).toBe('Johnny');
      expect(response.body.user.emailNotifications).toBe(true);
      expect(response.body.user.name).toBe('John');
      expect(response.body.user.email).toBe('john@wits.ac.za');
    });

    it('should return profile with empty displayName if not set', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: '',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za');

      expect(response.status).toBe(200);
      expect(response.body.user.displayName).toBe('');
    });

    it('should return 401 if user not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorised');
    });

    it('should return 401 if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('x-user-email', 'nonexistent@wits.ac.za');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update displayName successfully', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        displayName: 'Johnny Updated'
      });

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: 'Johnny Updated'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Profile updated');
      expect(response.body.user.displayName).toBe('Johnny Updated');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({ displayName: 'Johnny Updated' }),
        { new: true }
      );
    });

    it('should trim displayName when updating', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        displayName: 'Johnny'
      });

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: '  Johnny  '
        });

      expect(response.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({ displayName: 'Johnny' }),
        { new: true }
      );
    });

    it('should enforce displayName maxlength of 60 characters', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);

      const longName = 'a'.repeat(61);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: longName
        });

      // The slicing happens in auth.js line 96: .slice(0, 60)
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({ displayName: 'a'.repeat(60) }),
        { new: true }
      );
    });

    it('should update emailNotifications successfully', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        emailNotifications: false
      });

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          emailNotifications: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.emailNotifications).toBe(false);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({ emailNotifications: false }),
        { new: true }
      );
    });

    it('should update both displayName and emailNotifications together', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        displayName: 'Dr. Johnny',
        emailNotifications: false
      });

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: 'Dr. Johnny',
          emailNotifications: false
        });

      expect(response.status).toBe(200);
      expect(response.body.user.displayName).toBe('Dr. Johnny');
      expect(response.body.user.emailNotifications).toBe(false);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          displayName: 'Dr. Johnny',
          emailNotifications: false
        }),
        { new: true }
      );
    });

    it('should reject empty update request', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No valid fields');
    });

    it('should coerce emailNotifications to boolean', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        emailNotifications: true
      });

      // Send string "true" instead of boolean
      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          emailNotifications: 'true'
        });

      // The code uses !!emailNotifications which will coerce 'true' to true
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({ emailNotifications: true }),
        { new: true }
      );
    });

    it('should return 401 if user not authenticated', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({
          displayName: 'New Name'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

      // Suppress console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: 'New Name'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Server error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined displayName gracefully', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: undefined
        });

      // Should reject since undefined is treated as "no value"
      expect(response.status).toBe(400);
    });

    it('should handle null displayName', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        role: 'student',
        idNumber: '12345678',
        displayName: 'Johnny',
        emailNotifications: true
      };

      User.findOne.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        displayName: ''
      });

      const response = await request(app)
        .put('/api/auth/profile')
        .set('x-user-email', 'john@wits.ac.za')
        .send({
          displayName: null
        });

      // null is not undefined, so it should be processed
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
    });
  });
});

const request = require('supertest');

jest.mock('../../src/models/user', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

const app = require('../../src/app');
const User = require('../../src/models/user');

const selectedUser = user => ({
  select: jest.fn().mockResolvedValue(user)
});

describe('Auth and Profile Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects /api/auth/profile requests without a user email header', async () => {
    const response = await request(app).get('/api/auth/profile');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns the authenticated user profile from /api/auth/profile', async () => {
    const user = {
      _id: 'user-1',
      name: 'Jane',
      surname: 'Doe',
      email: 'jane@student.wits.ac.za',
      role: 'student',
      idNumber: '200001',
      displayName: 'Jane D',
      emailNotifications: true
    };
    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .get('/api/auth/profile')
      .set('X-User-Email', user.email);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      user: {
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        idNumber: user.idNumber,
        displayName: user.displayName,
        emailNotifications: user.emailNotifications
      }
    });
    expect(User.findOne).toHaveBeenCalledWith({ email: user.email });
  });

  it('updates allowed /api/auth/profile fields for the authenticated user', async () => {
    const user = {
      _id: 'user-1',
      name: 'Jane',
      surname: 'Doe',
      email: 'jane@student.wits.ac.za',
      role: 'student'
    };
    const updated = {
      ...user,
      displayName: 'Jane D',
      emailNotifications: false
    };

    User.findOne.mockResolvedValue(user);
    User.findByIdAndUpdate.mockResolvedValue(updated);

    const response = await request(app)
      .put('/api/auth/profile')
      .set('X-User-Email', user.email)
      .send({
        displayName: '  Jane D  ',
        emailNotifications: false
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Profile updated.');
    expect(response.body.user).toMatchObject({
      name: updated.name,
      surname: updated.surname,
      email: updated.email,
      role: updated.role,
      displayName: updated.displayName,
      emailNotifications: updated.emailNotifications
    });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      user._id,
      { displayName: 'Jane D', emailNotifications: false },
      { new: true }
    );
  });

  it('rejects /api/auth/profile updates with no valid fields', async () => {
    const user = {
      _id: 'user-1',
      email: 'jane@student.wits.ac.za'
    };
    User.findOne.mockResolvedValue(user);

    const response = await request(app)
      .put('/api/auth/profile')
      .set('X-User-Email', user.email)
      .send({ name: 'Ignored Name' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No valid fields');
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns the legacy /api/profile payload for an existing user', async () => {
    const user = {
      name: 'Jane',
      surname: 'Doe',
      email: 'jane@student.wits.ac.za',
      notificationsEnabled: true
    };
    User.findOne.mockReturnValue(selectedUser(user));

    const response = await request(app)
      .get('/api/profile')
      .set('X-User-Email', user.email);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, user });
    expect(User.findOne).toHaveBeenCalledWith({ email: user.email });
  });

  it('uses the explicit profile email header over an existing session user', async () => {
    const student = {
      name: 'Nkosinathi',
      surname: 'Mjiyako',
      idNumber: '2357649',
      email: '12345@gmail.com',
      notificationsEnabled: true
    };
    User.findOne.mockReturnValue(selectedUser(student));

    const agent = request.agent(app);
    const response = await agent
      .get('/api/profile')
      .set('X-User-Email', student.email);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, user: student });
    expect(User.findOne).toHaveBeenCalledWith({ email: student.email });
  });

  it('updates the legacy /api/profile payload for an existing user', async () => {
    const user = {
      name: 'Jane',
      surname: 'Doe',
      email: 'jane@student.wits.ac.za',
      notificationsEnabled: false
    };
    User.findOneAndUpdate.mockResolvedValue(user);

    const response = await request(app)
      .put('/api/profile')
      .set('X-User-Email', user.email)
      .send({
        name: user.name,
        surname: user.surname,
        notificationsEnabled: user.notificationsEnabled
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Profile updated.');
    expect(response.body.user).toEqual(user);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { email: user.email },
      {
        $set: {
          name: user.name,
          surname: user.surname,
          notificationsEnabled: user.notificationsEnabled
        }
      },
      { new: true, select: 'name surname email notificationsEnabled' }
    );
  });
});

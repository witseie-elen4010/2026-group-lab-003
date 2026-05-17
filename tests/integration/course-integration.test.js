const request = require('supertest');

jest.mock('../../src/models/Course', () => {
  const save = jest.fn();
  const Course = jest.fn(function Course(data) {
    Object.assign(this, data);
    this.save = save;
  });

  Course.find = jest.fn();
  Course.findOne = jest.fn();
  Course.findOneAndUpdate = jest.fn();
  Course.findOneAndDelete = jest.fn();
  Course.prototype.save = save;

  return Course;
});

const app = require('../../src/app');
const Course = require('../../src/models/Course');

describe('Course Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists courses sorted by code', async () => {
    const courses = [
      { code: 'ELEN4010', name: 'Software Development III', lecturers: ['lecturer@wits.ac.za'] }
    ];
    const sort = jest.fn().mockResolvedValue(courses);
    Course.find.mockReturnValue({ sort });

    const response = await request(app).get('/api/courses');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(courses);
    expect(Course.find).toHaveBeenCalledWith();
    expect(sort).toHaveBeenCalledWith({ code: 1 });
  });

  it('gets a single course by uppercase course code', async () => {
    const course = { code: 'ELEN4010', name: 'Software Development III', lecturers: [] };
    Course.findOne.mockResolvedValue(course);

    const response = await request(app).get('/api/courses/elen4010');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(course);
    expect(Course.findOne).toHaveBeenCalledWith({ code: 'ELEN4010' });
  });

  it('returns 404 when a course does not exist', async () => {
    Course.findOne.mockResolvedValue(null);

    const response = await request(app).get('/api/courses/missing101');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Course not found');
  });

  it('creates a new course when the code is unused', async () => {
    Course.findOne.mockResolvedValue(null);
    Course.prototype.save.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/courses')
      .send({
        code: 'elen4010',
        name: 'Software Development III',
        lecturers: ['lecturer@wits.ac.za']
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      code: 'ELEN4010',
      name: 'Software Development III',
      lecturers: ['lecturer@wits.ac.za']
    });
    expect(Course).toHaveBeenCalledWith({
      code: 'ELEN4010',
      name: 'Software Development III',
      lecturers: ['lecturer@wits.ac.za']
    });
    expect(Course.prototype.save).toHaveBeenCalled();
  });

  it('adds only new lecturers when creating a course that already exists', async () => {
    const existing = {
      code: 'ELEN4010',
      name: 'Old Name',
      lecturers: ['first@wits.ac.za'],
      save: jest.fn().mockResolvedValue(true)
    };
    Course.findOne.mockResolvedValue(existing);

    const response = await request(app)
      .post('/api/courses')
      .send({
        code: 'elen4010',
        name: 'Software Development III',
        lecturers: ['first@wits.ac.za', 'second@wits.ac.za']
      });

    expect(response.status).toBe(200);
    expect(existing.name).toBe('Software Development III');
    expect(existing.lecturers).toEqual(['first@wits.ac.za', 'second@wits.ac.za']);
    expect(existing.save).toHaveBeenCalled();
  });

  it('rejects course creation without a code or name', async () => {
    const response = await request(app)
      .post('/api/courses')
      .send({ code: 'ELEN4010' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Course code and name are required');
    expect(Course.findOne).not.toHaveBeenCalled();
  });

  it('updates an existing course by code', async () => {
    const updated = {
      code: 'ELEN4010',
      name: 'Updated Course',
      lecturers: ['lecturer@wits.ac.za']
    };
    Course.findOneAndUpdate.mockResolvedValue(updated);

    const response = await request(app)
      .put('/api/courses/elen4010')
      .send({ name: updated.name, lecturers: updated.lecturers });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updated);
    expect(Course.findOneAndUpdate).toHaveBeenCalledWith(
      { code: 'ELEN4010' },
      { $set: { name: updated.name, lecturers: updated.lecturers } },
      { new: true, runValidators: true }
    );
  });

  it('returns 404 when updating a missing course', async () => {
    Course.findOneAndUpdate.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/courses/missing101')
      .send({ name: 'Missing Course', lecturers: [] });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Course not found');
  });

  it('deletes an existing course by code', async () => {
    Course.findOneAndDelete.mockResolvedValue({ code: 'ELEN4010' });

    const response = await request(app).delete('/api/courses/elen4010');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Course deleted');
    expect(Course.findOneAndDelete).toHaveBeenCalledWith({ code: 'ELEN4010' });
  });

  it('returns 404 when deleting a missing course', async () => {
    Course.findOneAndDelete.mockResolvedValue(null);

    const response = await request(app).delete('/api/courses/missing101');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Course not found');
  });
});

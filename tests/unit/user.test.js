const mongoose = require('mongoose');
const User = require('../../src/models/user');

// Mock MongoDB connection
jest.mock('../../src/config/db');

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Fields - Basic Validation', () => {
    it('should create a user with all required fields', () => {
      const userData = {
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        role: 'student',
        password: 'hashed_password_12345'
      };

      const user = new User(userData);

      expect(user.name).toBe('John');
      expect(user.surname).toBe('Doe');
      expect(user.idNumber).toBe('12345678');
      expect(user.email).toBe('john@wits.ac.za');
      expect(user.role).toBe('student');
    });

    it('should reject user without required name field', () => {
      const userData = {
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'hashed_password_12345'
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error.errors.name).toBeDefined();
      expect(error.errors.name.message).toContain('Please add your name');
    });

    it('should reject user without required surname field', () => {
      const userData = {
        name: 'John',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'hashed_password_12345'
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error.errors.surname).toBeDefined();
      expect(error.errors.surname.message).toContain('Please add your surname');
    });

    it('should reject user without required idNumber field', () => {
      const userData = {
        name: 'John',
        surname: 'Doe',
        email: 'john@wits.ac.za',
        password: 'hashed_password_12345'
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error.errors.idNumber).toBeDefined();
      expect(error.errors.idNumber.message).toContain('Please add your student or lecturer number');
    });

    it('should reject user without required email field', () => {
      const userData = {
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        password: 'hashed_password_12345'
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.message).toContain('Please add an email');
    });

    it('should reject user without required password field', () => {
      const userData = {
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za'
      };

      const user = new User(userData);
      const error = user.validateSync();

      expect(error.errors.password).toBeDefined();
      expect(error.errors.password.message).toContain('Please add a password');
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email format', () => {
      const validEmails = [
        'john@wits.ac.za',
        'user.name@domain.com',
        'test+tag@example.org'
      ];

      validEmails.forEach(email => {
        const user = new User({
          name: 'John',
          surname: 'Doe',
          idNumber: '12345678',
          email: email,
          password: 'hashed_password_12345'
        });

        const error = user.validateSync();
        expect(error?.errors?.email).toBeUndefined();
      });
    });

    it('should reject invalid email format', () => {
      const invalidEmails = [
        'notanemail',
        '@nodomain.com',
        'user@',
        'user @domain.com'
      ];

      invalidEmails.forEach(email => {
        const user = new User({
          name: 'John',
          surname: 'Doe',
          idNumber: '12345678',
          email: email,
          password: 'hashed_password_12345'
        });

        const error = user.validateSync();
        expect(error?.errors?.email).toBeDefined();
        expect(error?.errors?.email?.message).toContain('Please add a valid email');
      });
    });
  });

  describe('Password Validation', () => {
    it('should reject password shorter than 8 characters', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'short'
      });

      const error = user.validateSync();

      expect(error.errors.password).toBeDefined();
      expect(error.errors.password.message).toContain('8');
    });

    it('should accept password with 8 or more characters', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123'
      });

      const error = user.validateSync();

      expect(error?.errors?.password).toBeUndefined();
    });
  });

  describe('Role Enum Validation', () => {
    it('should accept valid role values', () => {
      ['student', 'lecturer'].forEach(role => {
        const user = new User({
          name: 'John',
          surname: 'Doe',
          idNumber: '12345678',
          email: 'john@wits.ac.za',
          password: 'validpassword123',
          role: role
        });

        const error = user.validateSync();
        expect(error?.errors?.role).toBeUndefined();
      });
    });

    it('should reject invalid role values', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        role: 'admin'
      });

      const error = user.validateSync();

      expect(error.errors.role).toBeDefined();
    });

    it('should default to student role', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123'
      });

      expect(user.role).toBe('student');
    });
  });

  describe('NEW: displayName Field', () => {
    it('should accept displayName field', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        displayName: 'Johnny'
      });

      expect(user.displayName).toBe('Johnny');
    });

    it('should trim whitespace from displayName', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        displayName: '  Johnny  '
      });

      expect(user.displayName).toBe('Johnny');
    });

    it('should enforce maxlength of 60 characters on displayName', () => {
      const longName = 'a'.repeat(61);
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        displayName: longName
      });

      const error = user.validateSync();

      expect(error?.errors?.displayName).toBeDefined();
    });

    it('should accept displayName with 60 characters', () => {
      const validName = 'a'.repeat(60);
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        displayName: validName
      });

      const error = user.validateSync();

      expect(error?.errors?.displayName).toBeUndefined();
    });

    it('should default displayName to empty string', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123'
      });

      expect(user.displayName).toBe('');
    });
  });

  describe('NEW: emailNotifications Field', () => {
    it('should accept emailNotifications boolean value', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        emailNotifications: false
      });

      expect(user.emailNotifications).toBe(false);
    });

    it('should default emailNotifications to true', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123'
      });

      expect(user.emailNotifications).toBe(true);
    });

    it('should allow emailNotifications to be set to true', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123',
        emailNotifications: true
      });

      expect(user.emailNotifications).toBe(true);
    });
  });

  describe('Timestamp Fields', () => {
    it('should have createdAt and updatedAt timestamps', () => {
      const user = new User({
        name: 'John',
        surname: 'Doe',
        idNumber: '12345678',
        email: 'john@wits.ac.za',
        password: 'validpassword123'
      });

      const schemaOptions = user.schema.options;

      expect(schemaOptions.timestamps).toBe(true);
    });
  });

  describe('Password Select Option', () => {
    it('should not select password by default in queries', () => {
      const passwordPath = User.schema.path('password');

      expect(passwordPath.options.select).toBe(false);
    });
  });

  describe('Unique Constraints', () => {
    it('should require unique email', () => {
      const emailPath = User.schema.path('email');

      expect(emailPath.options.unique).toBe(true);
    });

    it('should require unique idNumber', () => {
      const idPath = User.schema.path('idNumber');

      expect(idPath.options.unique).toBe(true);
    });
  });

  describe('Combined Fields Test', () => {
    it('should create complete user profile with all optional fields', () => {
      const completeUser = new User({
        name: 'Jane',
        surname: 'Smith',
        idNumber: '87654321',
        email: 'jane@wits.ac.za',
        role: 'lecturer',
        password: 'securepassword123',
        displayName: 'Dr. Jane Smith',
        emailNotifications: false
      });

      expect(completeUser.name).toBe('Jane');
      expect(completeUser.surname).toBe('Smith');
      expect(completeUser.displayName).toBe('Dr. Jane Smith');
      expect(completeUser.emailNotifications).toBe(false);
      expect(completeUser.role).toBe('lecturer');

      const error = completeUser.validateSync();
      expect(error).toBeUndefined();
    });
  });
});

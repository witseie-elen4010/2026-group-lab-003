/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const frontendScript = file => path.join(__dirname, '..', '..', 'public', 'js', file);
const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function loadFreshScript(file) {
  jest.resetModules();
  require(frontendScript(file));
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn();
  global.alert = jest.fn();
  global.confirm = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Login page tests
describe('Login page browser script', () => {
  function setupLoginDom() {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="email" />
        <span id="emailError"></span>
        <input id="password" type="password" />
        <span id="passwordError"></span>
        <button id="togglePassword" type="button">visibility</button>
        <input id="remember" type="checkbox" />
        <div id="message"></div>
      </form>
    `;
  }

  it('toggles password visibility', () => {
    setupLoginDom();
    loadFreshScript('login-page.js');

    document.getElementById('togglePassword').click();

    expect(document.getElementById('password').type).toBe('text');
    expect(document.getElementById('togglePassword').textContent).toBe('visibility_off');
  });

  it('blocks invalid login submissions before calling the API', async () => {
    setupLoginDom();
    loadFreshScript('login-page.js');

    document.getElementById('loginForm').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById('emailError').textContent).toContain('Please enter your email');
    expect(document.getElementById('passwordError').textContent).toContain('Please enter your password');
  });

  it('stores the logged-in user in session storage after a successful login', async () => {
    setupLoginDom();
    fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        success: true,
        user: {
          name: 'Jane',
          surname: 'Doe',
          idNumber: '200001',
          role: 'student'
        }
      })
    });
    loadFreshScript('login-page.js');

    document.getElementById('email').value = 'jane@student.wits.ac.za';
    document.getElementById('password').value = 'SecurePassword123!';
    document.getElementById('loginForm').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'jane@student.wits.ac.za',
        password: 'SecurePassword123!'
      })
    }));
    expect(JSON.parse(sessionStorage.getItem('sychro_current_user'))).toMatchObject({
      email: 'jane@student.wits.ac.za',
      name: 'Jane',
      surname: 'Doe',
      idNumber: '200001',
      role: 'student'
    });
    expect(alert).toHaveBeenCalledWith('Login Successful!');
  });
});

// Registration page tests
describe('Registration page browser script', () => {
  function setupRegistrationDom() {
    document.body.innerHTML = `
      <form id="registrationForm">
        <input id="name" />
        <span id="nameError"></span>
        <input id="surname" />
        <span id="surnameError"></span>
        <input id="idNumber" />
        <span id="studnoError"></span>
        <input id="email" />
        <span id="emailError"></span>
        <select id="role"><option value="student">Student</option><option value="lecturer">Lecturer</option></select>
        <input id="password" type="password" />
        <span id="passwordError"></span>
        <input id="confirmPassword" type="password" />
        <button id="togglePassword1" type="button">visibility</button>
        <button id="togglePassword2" type="button">visibility</button>
        <div id="error-message" style="display:none"></div>
      </form>
    `;
  }

  it('blocks weak passwords before calling the registration API', async () => {
    setupRegistrationDom();
    loadFreshScript('register-page.js');

    document.getElementById('name').value = 'Jane';
    document.getElementById('surname').value = 'Doe';
    document.getElementById('idNumber').value = '200001';
    document.getElementById('email').value = 'jane@student.wits.ac.za';
    document.getElementById('password').value = 'short';
    document.getElementById('confirmPassword').value = 'short';
    document.getElementById('registrationForm').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById('passwordError').textContent).toContain('Weak Password');
  });

  it('sends valid registration data to the API', async () => {
    setupRegistrationDom();
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
    loadFreshScript('register-page.js');

    document.getElementById('name').value = 'Jane';
    document.getElementById('surname').value = 'Doe';
    document.getElementById('idNumber').value = '200001';
    document.getElementById('email').value = 'jane@student.wits.ac.za';
    document.getElementById('role').value = 'student';
    document.getElementById('password').value = 'SecurePassword123!';
    document.getElementById('confirmPassword').value = 'SecurePassword123!';
    document.getElementById('registrationForm').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith('/api/register', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane',
        surname: 'Doe',
        idNumber: '200001',
        email: 'jane@student.wits.ac.za',
        role: 'student',
        password: 'SecurePassword123!'
      })
    }));
    expect(alert).toHaveBeenCalledWith('Welcome to Synchro! Redirecting to login...');
  });
});

// Booking page tests
describe('Booking page browser script', () => {
  function setupBookingDom() {
    document.body.innerHTML = `
      <select id="module"><option value="ELEN4010">ELEN4010</option></select>
      <select id="lecturerId"><option value="lecturer_1">Dr Smith</option></select>
      <input id="bookingDate" type="date" />
      <div id="time-slots-container"></div>
      <input id="selectedStartTime" />
      <input id="selectedEndTime" />
      <form id="newBookingForm">
        <textarea id="topic"></textarea>
        <button class="book_button" type="submit">Confirm Booking</button>
      </form>
    `;
  }

  it('loads open slots, selects one, and submits a booking', async () => {
    setupBookingDom();
    sessionStorage.setItem('sychro_current_user', JSON.stringify({
      email: 'student@wits.ac.za'
    }));
    fetch
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          duration: 30,
          availableBlocks: [{ start: '09:00', end: '10:00' }],
          bookedTimes: ['09:00']
        })
      })
      .mockResolvedValueOnce({ ok: true });
    loadFreshScript('booking-page.js');

    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.getElementById('module').value = 'ELEN4010';
    document.getElementById('lecturerId').value = 'lecturer_1';
    document.getElementById('bookingDate').value = '2026-06-01';
    document.getElementById('bookingDate').dispatchEvent(new Event('change'));
    await flushPromises();

    const slotButton = document.querySelector('.slot-btn');
    expect(slotButton.innerText).toBe('09:30 - 10:00');

    slotButton.click();
    expect(document.getElementById('selectedStartTime').value).toBe('09:30');
    expect(document.getElementById('selectedEndTime').value).toBe('10:00');

    document.getElementById('topic').value = 'Project planning';
    document.getElementById('newBookingForm').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
    await flushPromises();

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/bookings', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 'student@wits.ac.za',
        module: 'ELEN4010',
        lecturerId: 'lecturer_1',
        date: '2026-06-01',
        startTime: '09:30',
        endTime: '10:00',
        participantIDs: ['student@wits.ac.za'],
        topic: 'Project planning'
      })
    }));
    expect(alert).toHaveBeenCalledWith('Booking successful!');
  });
});

// Lecturer availability page tests
describe('Lecturer availability browser script', () => {
  function setupAvailabilityDom() {
    document.body.innerHTML = `
      <button id="addSlotBtn" type="button"></button>
      <button id="resetBtn" type="button"></button>
      <form id="availabilityForm"></form>
      <select id="defaultDuration"><option value="30">30</option></select>
      <input id="slotCapacity" value="1" />
      <input id="dailySessionLimit" value="10" />
      <div id="slotsContainer"></div>
      <button class="btn-primary-custom" type="submit">Save Changes</button>
      <div id="preview"></div>
    `;
  }

  it('loads a saved schedule and posts updates to /api/schedules', async () => {
    jest.useFakeTimers();
    setupAvailabilityDom();
    sessionStorage.setItem('sychro_current_user', JSON.stringify({
      name: 'Prof',
      surname: 'Smith',
      idNumber: 'STAFF123',
      email: 'lecturer@wits.ac.za'
    }));
    fetch
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          slotCapacity: 2,
          dailySessionLimit: 6,
          weeklySchedule: [
            { dayOfWeek: 1, slots: [{ start: '09:00', end: '10:00' }] }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ message: 'Schedule saved' })
      });
    loadFreshScript('lecturer-availability.js');

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/schedules', {
      headers: { 'X-Lecturer-Id': 'STAFF123' }
    });
    expect(document.getElementById('slotCapacity').value).toBe('2');
    expect(document.querySelector('.day-check[value="mon"]').checked).toBe(true);

    document.getElementById('availabilityForm').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
    await flushPromises();

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/schedules', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lecturer-Id': 'STAFF123',
        'X-Lecturer-Name': 'Prof Smith'
      }
    }));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      staffId: 'STAFF123',
      slotCapacity: 2,
      dailySessionLimit: 6,
      weeklySchedule: [
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '10:00' }] }
      ]
    });
    jest.runOnlyPendingTimers();
  });
});

// Activity log page tests
describe('Activity log browser script', () => {
  const tempPath = frontendScript('activity-log-testable.js');

  function loadActivityLogManager() {
    const sourceCode = fs.readFileSync(frontendScript('activity-log.js'), 'utf8');
    const classOnly = sourceCode
      .replace('const activityLog = new ActivityLogManager();', '')
      .replace('window.activityLog = activityLog;', '');
    fs.writeFileSync(tempPath, `${classOnly}\nmodule.exports = { ActivityLogManager };\n`);

    jest.resetModules();
    return require(tempPath).ActivityLogManager;
  }

  function setupActivityLogDom() {
    document.body.innerHTML = `
      <span id="total-activities"></span>
      <span id="today-activities"></span>
      <span id="created-count"></span>
      <span id="canceled-count"></span>
      <span id="active-users"></span>
      <select id="action-type-filter">
        <option value="all">All</option>
        <option value="created">Created</option>
        <option value="canceled">Canceled</option>
      </select>
      <select id="user-filter"></select>
      <select id="date-range-filter"><option value="all">All</option><option value="custom">Custom</option></select>
      <input id="search-input" />
      <div id="custom-date-range" class="hidden"></div>
      <input id="start-date" />
      <input id="end-date" />
      <div id="activity-timeline"></div>
      <div id="empty-state" class="hidden"></div>
      <div id="detail-modal" class="hidden"><div id="detail-content"></div></div>
      <span id="current-page"></span>
      <span id="total-pages"></span>
      <button id="prev-page"></button>
      <button id="next-page"></button>
      <button id="apply-date-range"></button>
      <button id="clear-filters-btn"></button>
      <button id="export-activity-btn"></button>
      <button id="clear-all-btn"></button>
      <button id="auto-refresh-toggle"><span>Auto-refresh</span></button>
      <button id="close-detail-modal"></button>
    `;
  }

  function mockActivityApi(initialActivities = []) {
    let activities = [...initialActivities];

    fetch.mockImplementation((url, options = {}) => {
      if (url !== '/api/activities') {
        return Promise.resolve({ ok: false, json: jest.fn().mockResolvedValue({}) });
      }

      if (options.method === 'POST') {
        const entry = JSON.parse(options.body);
        activities = [{ id: `a${activities.length + 1}`, ...entry }, ...activities];
        return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue(entry) });
      }

      if (options.method === 'DELETE') {
        activities = [];
        return Promise.resolve({ ok: true, json: jest.fn().mockResolvedValue({}) });
      }

      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue(activities)
      });
    });
  }

  afterAll(() => {
    try {
      fs.unlinkSync(tempPath);
    } catch (err) {
      // Temp file may already be gone.
    }
  });

  it('logs activity, updates stats, and escapes rendered text', async () => {
    setupActivityLogDom();
    mockActivityApi();
    sessionStorage.setItem('sychro_current_user', JSON.stringify({
      fullName: 'Jane Doe',
      email: 'jane@student.wits.ac.za',
      id: 'student-1'
    }));
    const ActivityLogManager = loadActivityLogManager();
    const manager = new ActivityLogManager();
    await flushPromises();

    await manager.logAction('created', 'Created <script>alert(1)</script>');

    expect(document.getElementById('total-activities').textContent).toBe('1');
    expect(document.getElementById('created-count').textContent).toBe('1');
    expect(document.getElementById('user-filter').textContent).toContain('Jane Doe');
    expect(document.getElementById('activity-timeline').innerHTML).toContain('&lt;script&gt;');
    expect(fetch).toHaveBeenCalledWith('/api/activities', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }));
  });

  it('loads stored activities and applies filters', async () => {
    setupActivityLogDom();
    mockActivityApi([
      {
        id: 'a1',
        type: 'created',
        description: 'Created booking',
        user: 'Jane Doe',
        timestamp: new Date().toISOString(),
        metadata: {}
      },
      {
        id: 'a2',
        type: 'canceled',
        description: 'Canceled booking',
        user: 'John Smith',
        timestamp: new Date().toISOString(),
        metadata: {}
      }
    ]);
    const ActivityLogManager = loadActivityLogManager();
    const manager = new ActivityLogManager();
    await flushPromises();

    expect(document.getElementById('activity-timeline').textContent).toContain('Created booking');
    expect(document.getElementById('activity-timeline').textContent).toContain('Canceled booking');

    document.getElementById('action-type-filter').value = 'canceled';
    manager.handleFilterChange();

    expect(manager.filteredActivities).toHaveLength(1);
    expect(document.getElementById('activity-timeline').textContent).toContain('Canceled booking');
    expect(document.getElementById('activity-timeline').textContent).not.toContain('Created booking');
  });

  it('shows activity details and closes the modal', async () => {
    setupActivityLogDom();
    mockActivityApi([
      {
        id: 'a1',
        type: 'created',
        description: 'Created <b>booking</b>',
        user: 'Jane Doe',
        timestamp: new Date().toISOString(),
        metadata: {}
      }
    ]);
    const ActivityLogManager = loadActivityLogManager();
    const manager = new ActivityLogManager();
    await flushPromises();

    manager.showDetail('a1');

    expect(document.getElementById('detail-modal').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('detail-content').innerHTML).toContain('&lt;b&gt;booking&lt;/b&gt;');

    manager.closeModal();
    expect(document.getElementById('detail-modal').classList.contains('hidden')).toBe(true);
  });

  it('exports visible activities as CSV', async () => {
    setupActivityLogDom();
    mockActivityApi([
      {
        id: 'a1',
        type: 'created',
        description: 'Created booking',
        user: 'Jane Doe',
        timestamp: new Date().toISOString(),
        metadata: {}
      }
    ]);
    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:activity-log');
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const ActivityLogManager = loadActivityLogManager();
    const manager = new ActivityLogManager();
    await flushPromises();

    manager.exportCSV();

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:activity-log');
  });

  it('clears all activity when confirmed', async () => {
    setupActivityLogDom();
    confirm.mockReturnValue(true);
    mockActivityApi([
      {
        id: 'a1',
        type: 'created',
        description: 'Created booking',
        user: 'Jane Doe',
        timestamp: new Date().toISOString(),
        metadata: {}
      }
    ]);
    const ActivityLogManager = loadActivityLogManager();
    const manager = new ActivityLogManager();
    await flushPromises();

    await manager.clearAll();

    expect(manager.activities).toEqual([]);
    expect(fetch).toHaveBeenCalledWith('/api/activities', expect.objectContaining({
      method: 'DELETE'
    }));
    expect(document.getElementById('empty-state').classList.contains('hidden')).toBe(false);
  });

  it('toggles auto refresh state', async () => {
    jest.useFakeTimers();
    setupActivityLogDom();
    mockActivityApi();
    const ActivityLogManager = loadActivityLogManager();
    const manager = new ActivityLogManager();
    await flushPromises();
    const toggle = document.getElementById('auto-refresh-toggle');

    manager.toggleAutoRefresh();
    expect(toggle.classList.contains('active')).toBe(true);
    expect(toggle.querySelector('span').textContent).toBe('Auto-refresh ON');

    manager.toggleAutoRefresh();
    expect(toggle.classList.contains('active')).toBe(false);
    expect(toggle.querySelector('span').textContent).toBe('Auto-refresh');
  });
});

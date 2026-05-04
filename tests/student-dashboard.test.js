/** @jest-environment jsdom */

const { StudentScheduleManager } = require('../public/js/student-dashboard.js') // Update path if needed

describe('StudentScheduleManager', () => {
  let manager

  // 1. Setup a fake localStorage and sessionStorage environment
  const storageMock = (() => {
    let store = {}
    return {
      getItem: key => store[key] || null,
      setItem: (key, value) => { store[key] = value.toString() },
      clear: () => { store = {} }
    }
  })()

  Object.defineProperty(window, 'localStorage', { value: storageMock })
  Object.defineProperty(window, 'sessionStorage', { value: storageMock })

  beforeEach(() => {
    // 2. Clear storages before each test to ensure a clean slate
    window.localStorage.clear()
    window.sessionStorage.clear()

    // 3. Inject the exact HTML structure your class expects
    document.body.innerHTML = `
      <div id="current-date">Loading...</div>
      <div id="today-bookings">0</div>
      <div id="upcoming-week">0</div>
      <div id="total-completed">0</div>
      <div id="canceled-count">0</div>
      <select id="status-filter"><option value="all">All</option></select>
      <select id="course-filter"><option value="all">All</option></select>
      <select id="date-filter"><option value="all">All</option></select>
      <input type="text" id="search-input" class="search-input">
      <div id="schedule-list"></div>
      <div id="empty-state" class="hidden"></div>
      <div id="session-modal" class="hidden"></div>
      <div id="session-detail-content"></div>
      <button id="refresh-btn"></button>
      <button id="close-session-modal"></button>
    `

    // 4. Initialize a fresh manager instance
    manager = new StudentScheduleManager()
  })

  describe('Helper Methods', () => {
    test('formatTime converts 24h to 12h format correctly', () => {
      expect(manager.formatTime('09:30')).toBe('9:30 AM')
      expect(manager.formatTime('14:00')).toBe('2:00 PM')
      expect(manager.formatTime('00:15')).toBe('12:15 AM')
      expect(manager.formatTime('12:00')).toBe('12:00 PM')
      expect(manager.formatTime(null)).toBe('--:--')
    })

    test('escape method safely encodes HTML to prevent injection', () => {
      const malicious = '<script>alert("hack")</script>'
      const safe = manager.escape(malicious)
      // jsdom handles innerHTML conversion
      expect(safe).toBe('&lt;script&gt;alert("hack")&lt;/script&gt;')
      expect(manager.escape(null)).toBe('')
    })

    test('getTomorrow returns the correct YYYY-MM-DD format', () => {
      const tomorrow = manager.getTomorrow()
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('isThisWeek returns true for current week dates', () => {
      const today = new Date().toISOString().split('T')[0]
      expect(manager.isThisWeek(today)).toBe(true)
      expect(manager.isThisWeek('2000-01-01')).toBe(false)
    })
  })

  describe('Data Management', () => {
    test('loadCurrentStudent reads user from localStorage', () => {
      const mockStudent = { fullName: 'John Doe' }
      window.localStorage.setItem('sychro_current_user', JSON.stringify(mockStudent))

      manager.loadCurrentStudent()
      expect(manager.currentStudent.fullName).toBe('John Doe')
    })

    test('loadSessions filters out sessions not belonging to the current student', () => {
      manager.currentStudent = { fullName: 'Jane Doe' }

      const fakeSessions = [
        { id: 1, studentName: 'Jane Doe', topic: 'Math Help' },
        { id: 2, studentName: 'John Smith', topic: 'Physics Help' }, // Should be ignored
        { id: 3, joinedStudents: ['Jane Doe'], topic: 'Group Study' }
      ]
      window.localStorage.setItem('sychro_consultations', JSON.stringify(fakeSessions))

      manager.loadSessions()

      expect(manager.sessions.length).toBe(2)
      expect(manager.sessions[0].topic).toBe('Math Help')
      expect(manager.sessions[1].topic).toBe('Group Study')
    })
  })

  describe('Statistics & Filtering', () => {
    test('updateStats accurately counts statuses and dates', () => {
      const today = new Date().toISOString().split('T')[0]

      manager.sessions = [
        { status: 'completed', date: today }, // Counts for today (1)
        { status: 'completed', date: '2020-01-01' },
        { status: 'canceled', date: today },
        { status: 'upcoming', date: today } // Counts for today (2)
      ]

      manager.updateStats()

      // total-completed should be 2, canceled should be 1, today should be 2
      expect(document.getElementById('total-completed').textContent).toBe('2')
      expect(document.getElementById('canceled-count').textContent).toBe('1')
      expect(document.getElementById('today-bookings').textContent).toBe('2') // Fixed assertion
    })

    test('applyFilters filters array by status', () => {
      // Add 'time' properties to prevent the sort() function from getting NaN
      manager.sessions = [
        { status: 'upcoming', date: '2025-01-01', time: '10:00', courseCode: 'CS101' },
        { status: 'completed', date: '2025-01-02', time: '11:00', courseCode: 'CS102' }
      ]

      // Inject the option into the DOM before trying to select it!
      const statusFilter = document.getElementById('status-filter')
      statusFilter.innerHTML = `
        <option value="all">All</option>
        <option value="completed">Completed</option>
      `

      // Simulate UI change
      statusFilter.value = 'completed'

      manager.applyFilters()

      expect(manager.filteredSessions.length).toBe(1)
      expect(manager.filteredSessions[0].status).toBe('completed')
    })
  })

  describe('DOM Rendering & Actions', () => {
    test('render shows empty state when filteredSessions is empty', () => {
      manager.filteredSessions = []
      manager.render()

      const emptyStateEl = document.getElementById('empty-state')
      const scheduleListEl = document.getElementById('schedule-list')

      expect(emptyStateEl.classList.contains('hidden')).toBe(false)
      expect(scheduleListEl.innerHTML).toBe('')
    })

    test('showDetail populates and unhides the modal', () => {
      manager.sessions = [{
        id: '123',
        courseCode: 'CS101',
        lecturerName: 'Dr. Smith',
        date: '2025-10-10',
        time: '14:00',
        status: 'upcoming'
      }]

      manager.showDetail('123')

      const modal = document.getElementById('session-modal')
      const content = document.getElementById('session-detail-content')

      expect(modal.classList.contains('hidden')).toBe(false)
      expect(content.innerHTML).toContain('CS101')
      expect(content.innerHTML).toContain('Dr. Smith')
    })

    test('cancelBooking updates session status to canceled', () => {
      // Mock window.confirm to simulate the user clicking "OK"
      window.confirm = jest.fn(() => true)

      manager.sessions = [{ id: 'sess_1', status: 'upcoming' }]

      manager.cancelBooking('sess_1')

      expect(manager.sessions[0].status).toBe('canceled')
      expect(window.confirm).toHaveBeenCalled()
    })
  })
})

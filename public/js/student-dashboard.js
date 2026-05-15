class StudentScheduleManager {
  constructor () {
    this.userStorageKey = 'sychro_current_user'
    this.sessions = []
    this.filteredSessions = []
    this.currentStudent = null

    // Initialize Bootstrap Modal instance once
    this.bsModal = new bootstrap.Modal(document.getElementById('session-modal'))

    this.init()
  }

  async init () {
    this.loadCurrentStudent()
    await this.loadSessions()
    this.setupEventListeners()
    this.displayCurrentDate()
    this.updateStats()
    this.updateFilterOptions()
    this.applyFilters()
  }

  // DOM GETTERS
  get todayBookingsEl () { return document.getElementById('today-bookings') }
  get upcomingWeekEl () { return document.getElementById('upcoming-week') }
  get totalCompletedEl () { return document.getElementById('total-completed') }
  get canceledCountEl () { return document.getElementById('canceled-count') }
  get currentDateEl () { return document.getElementById('current-date') }
  get statusFilter () { return document.getElementById('status-filter') }
  get courseFilter () { return document.getElementById('course-filter') }
  get dateFilter () { return document.getElementById('date-filter') }
  get searchInput () { return document.getElementById('search-input') }
  get scheduleList () { return document.getElementById('schedule-list') }
  get emptyState () { return document.getElementById('empty-state') }
  get sessionDetailContent () { return document.getElementById('session-detail-content') }

  setupEventListeners () {
    this.statusFilter.addEventListener('change', () => this.handleFilterChange())
    this.courseFilter.addEventListener('change', () => this.handleFilterChange())
    this.dateFilter.addEventListener('change', () => this.handleFilterChange())
    this.searchInput.addEventListener('input', this.debounce(() => this.handleFilterChange(), 300))

    document.getElementById('refresh-btn').addEventListener('click', async () => {
      await this.loadSessions()
      this.updateStats()
      this.updateFilterOptions()
      this.applyFilters()
    })

    /* NOTE: We removed the menu-toggle and closeModal listeners.
       Bootstrap handles the dropdown and modal closing via data-bs attributes.
    */

    // Sign Out functionality
    const signOutBtn = document.querySelector('.sign-out')
    if (signOutBtn) {
      signOutBtn.addEventListener('click', (e) => {
        e.preventDefault()
        sessionStorage.removeItem(this.userStorageKey)
        localStorage.removeItem(this.userStorageKey)
        window.location.href = 'login-page.html'
      })
    }
  }

  handleFilterChange () {
    this.applyFilters()
  }

  // DATA MANAGEMENT
  loadCurrentStudent () {
    const sessionUser = sessionStorage.getItem(this.userStorageKey)
    if (sessionUser) {
      this.currentStudent = JSON.parse(sessionUser)
      return
    }
    const localUser = localStorage.getItem(this.userStorageKey)
    if (localUser) {
      this.currentStudent = JSON.parse(localUser)
      return
    }
    this.currentStudent = null
  }

  async loadSessions () {
    try {
      this.scheduleList.innerHTML = '<div class="text-center p-4 text-white">Loading your bookings...</div>'

      const user = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user'))

      if (!user || !user.email) {
        this.scheduleList.innerHTML = '<div class="text-center p-4 text-danger">Please log in to view your sessions.</div>'
        return
      }

      const studentEmail = user.email
      const response = await fetch(`/api/bookings?studentId=${studentEmail}`)
      const dbBookings = await response.json()

      this.sessions = dbBookings.map(b => {
        return {
          id: b._id,
          date: b.date,
          time: b.startTime,
          duration: 30,
          courseCode: b.module,
          lecturerName: b.lecturerId === 'lecturer_1' ? 'Dr. Smith' : 'Prof. Jones',
          topic: b.topic || 'No topic specified',
          status: b.status || 'upcoming'
        }
      })
    } catch (error) {
      console.error('Error fetching bookings from DB:', error)
      this.sessions = []
      this.scheduleList.innerHTML = '<div class="text-center p-4 text-danger">Failed to load bookings.</div>'
    }
  }

  applyFilters () {
    const status = this.statusFilter.value
    const course = this.courseFilter.value
    const date = this.dateFilter.value
    const searchTerm = this.searchInput.value.toLowerCase().trim()

    this.filteredSessions = this.sessions.filter(session => {
      if (status !== 'all' && session.status !== status) return false
      if (course !== 'all' && session.courseCode !== course) return false

      if (date !== 'all') {
        const sessionDate = session.date
        const today = new Date().toISOString().split('T')[0]
        const tomorrow = this.getTomorrow()

        if (date === 'today' && sessionDate !== today) return false
        if (date === 'tomorrow' && sessionDate !== tomorrow) return false
        if (date === 'this-week' && !this.isThisWeek(sessionDate)) return false
        if (date === 'next-week' && !this.isNextWeek(sessionDate)) return false
      }

      if (searchTerm) {
        const searchStr = `${session.lecturerName || ''} ${session.courseCode || ''} ${session.topic || ''}`.toLowerCase()
        if (!searchStr.includes(searchTerm)) return false
      }

      return true
    })

    this.filteredSessions.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateA - dateB
    })

    this.render()
  }

  updateFilterOptions () {
    const courses = [...new Set(this.sessions.map(s => s.courseCode).filter(Boolean))].sort()
    this.courseFilter.innerHTML = '<option value="all">All Courses</option>'
    courses.forEach(course => {
      const option = document.createElement('option')
      option.value = course
      option.textContent = course
      this.courseFilter.appendChild(option)
    })
  }

  updateStats () {
    const today = new Date().toISOString().split('T')[0]
    this.todayBookingsEl.textContent = this.sessions.filter(s => s.date === today && s.status !== 'canceled').length
    this.upcomingWeekEl.textContent = this.sessions.filter(s => (s.status === 'upcoming' || s.status === 'ongoing') && this.isThisWeek(s.date)).length
    this.totalCompletedEl.textContent = this.sessions.filter(s => s.status === 'completed').length
    this.canceledCountEl.textContent = this.sessions.filter(s => s.status === 'canceled').length
  }

  displayCurrentDate () {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    this.currentDateEl.textContent = new Date().toLocaleDateString('en-US', options)
  }

  render () {
    if (this.filteredSessions.length === 0) {
      this.scheduleList.innerHTML = ''
      this.emptyState.classList.remove('hidden')
    } else {
      this.emptyState.classList.add('hidden')
      this.scheduleList.innerHTML = this.filteredSessions.map(s => this.renderSessionCard(s)).join('')
    }
  }

  renderSessionCard (session) {
    const timeDisplay = this.formatTime(session.time)
    const location = session.location || 'Online'

    return `
      <div class="session-card d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3 border-start border-4 ${config.border}">
          <div class="session-time text-center" style="min-width: 80px;">
              <div class="h4 fw-bold text-white mb-0">${timeDisplay}</div>
              <div class="small text-warning">${session.duration || 0} min</div>
          </div>
          <div class="session-info flex-grow-1">
              <div class="small text-warning fw-bold text-uppercase tracking-wider mb-1">${this.escape(session.courseCode || '')}</div>
              <div class="h5 text-white mb-2">${this.escape(session.topic)}</div>
              <div class="d-flex gap-3 small text-white-50">
                  <span><i class="fas fa-chalkboard-teacher me-1"></i> ${this.escape(session.lecturerName)}</span>
                  <span><i class="fas fa-map-marker-alt me-1"></i> ${this.escape(location)}</span>
              </div>
          </div>
          <div class="d-flex align-items-center gap-3">
              <span class="badge ${config.badge} rounded-pill px-3 py-2 text-uppercase" style="font-size: 0.7rem;">
                ${session.status}
              </span>
              <div class="btn-group">
                  <button class="btn btn-sm btn-outline-light rounded-pill" onclick="scheduleManager.showDetail('${session.id}')">
                      Details
                  </button>
              </div>
          </div>
      </div>
    `
  }

  showDetail (sessionId) {
    const session = this.sessions.find(s => s.id === sessionId)
    if (!session) return

    const content = document.getElementById('session-detail-content')

    this.sessionDetailContent.innerHTML = `
        <div class="detail-row d-flex justify-content-between py-2 border-bottom">
            <span class="fw-bold">Module:</span>
            <span>${this.escape(session.courseCode)}</span>
        </div>
        <div class="detail-row d-flex justify-content-between py-2 border-bottom">
            <span class="fw-bold">Date:</span>
            <span>${this.escape(session.date)}</span>
        </div>
        <div class="detail-row d-flex justify-content-between py-2 border-bottom">
            <span class="fw-bold">Time:</span>
            <span>${this.escape(session.time)}</span>
        </div>
        <div class="detail-row d-flex justify-content-between py-2 mb-4">
            <span class="fw-bold">Status:</span>
            <span class="badge status-${session.status}">${session.status}</span>
        </div>

        ${session.status === 'upcoming'
? `
            <div style="margin-top: 20px; text-align: center;">
                <button class="btn btn-danger" onclick="scheduleManager.cancelBooking('${session.id}')" style="width: 100%; border-radius: 25px;">
                    <i class="fas fa-trash-alt"></i> Cancel Consultation
                </button>
            </div>
        `
: ''}
    `
    // Use the Bootstrap instance to show the modal
    this.bsModal.show()
  }

  async cancelBooking (sessionId) {
    if (!confirm('Are you sure you want to cancel?')) return

    const currentUser = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user'))

    try {
      const response = await fetch(`/api/bookings/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentEmail: currentUser.email })
      })

      if (response.ok) {
        this.bsModal.hide() // Use Bootstrap instance to hide
        await this.loadSessions()
        this.applyFilters()
        this.updateStats()
      }
    } catch (error) {
      console.error('Cancellation Error:', error)
    }
  }

  // HELPERS
  formatTime (time) {
    if (!time) return '--:--'
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const period = h >= 12 ? 'PM' : 'AM'
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h)
    return `${displayHour}:${minutes} ${period}`
  }

  getTomorrow () {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  isThisWeek (dateStr) {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const today = new Date()
    const day = today.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday, 0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    return date >= startOfWeek && date <= endOfWeek
  }

  isNextWeek (dateStr) {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const today = new Date()
    const startOfNextWeek = new Date(today)
    startOfNextWeek.setDate(today.getDate() - today.getDay() + 7)
    const endOfNextWeek = new Date(startOfNextWeek)
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)
    return date >= startOfNextWeek && date <= endOfNextWeek
  }

  escape (str) {
    if (!str) return ''
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  debounce (fn, delay) {
    let timer
    return (...args) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn.apply(this, args), delay)
    }
  }
}

// INITIALIZE
if (typeof module === 'undefined') {
  const scheduleManager = new StudentScheduleManager()
  window.scheduleManager = scheduleManager
} else {
  module.exports = { StudentScheduleManager }
}

class StudentScheduleManager {
  constructor () {
    this.userStorageKey = 'sychro_current_user'
    this.sessions = []
    this.filteredSessions = []
    this.currentStudent = null

    this.init()
  }

  // 1. Make init async so we can wait for the database fetch
  async init () {
    this.loadCurrentStudent()
    await this.loadSessions() // Wait for database data
    this.setupEventListeners()
    this.displayCurrentDate()
    this.updateStats()
    this.updateFilterOptions()
    this.applyFilters() // Render immediately after applying filters
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
  get sessionModal () { return document.getElementById('session-modal') }
  get sessionDetailContent () { return document.getElementById('session-detail-content') }

  // EVENT LISTENERS
  setupEventListeners () {
    this.statusFilter.addEventListener('change', () => this.handleFilterChange())
    this.courseFilter.addEventListener('change', () => this.handleFilterChange())
    this.dateFilter.addEventListener('change', () => this.handleFilterChange())
    this.searchInput.addEventListener('input', this.debounce(() => this.handleFilterChange(), 300))

    // 2. Make the refresh button async
    document.getElementById('refresh-btn').addEventListener('click', async () => {
      await this.loadSessions()
      this.updateStats()
      this.updateFilterOptions()
      this.applyFilters()
    })

    document.getElementById('close-session-modal').addEventListener('click', () => this.closeModal())
    this.sessionModal.addEventListener('click', (e) => {
      if (e.target === this.sessionModal) this.closeModal()
    })
  }

  handleFilterChange () {
    this.applyFilters()
  }

  closeModal () {
    this.sessionModal.classList.add('hidden')
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
      this.scheduleList.innerHTML = '<div class="text-center p-4">Loading your bookings...</div>'

      // 1. Grab the user EXACTLY like we did on the booking page
      const user = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user'))

      // 2. Safety check
      if (!user || !user.email) {
        this.scheduleList.innerHTML = '<div class="text-center p-4 text-danger">Please log in to view your sessions.</div>'
        return
      }

      // 3. Fetch ONLY this student's bookings using their email
      const studentEmail = user.email
      const response = await fetch(`/api/bookings?studentId=${studentEmail}`)
      const dbBookings = await response.json()
      console.log("Bookings from Database:", dbBookings)

      // 4. Map the data to the UI
      this.sessions = dbBookings.map(b => {
        return {
          id: b._id,
          date: b.date,
          time: b.startTime,
          duration: 30,
          courseCode: b.module,
          lecturerName: b.lecturerId === 'lecturer_1' ? 'Dr. Smith' : 'Prof. Jones', // Update this based on how your lecturers are saved
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

  // FILTERING
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

  // STATISTICS
  updateStats () {
    const today = new Date().toISOString().split('T')[0]

    this.todayBookingsEl.textContent = this.sessions.filter(s => s.date === today && s.status !== 'canceled').length
    this.upcomingWeekEl.textContent = this.sessions.filter(s => (s.status === 'upcoming' || s.status === 'ongoing') && this.isThisWeek(s.date)).length
    this.totalCompletedEl.textContent = this.sessions.filter(s => s.status === 'completed').length
    this.canceledCountEl.textContent = this.sessions.filter(s => s.status === 'canceled').length
  }

  // RENDERING
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
    const statusClass = `status-${session.status}`
    const location = session.location || 'Online'

    return `
            <div class="session-card">
                <div class="session-time">
                    <div class="time">${timeDisplay}</div>
                    <div class="duration">${session.duration || 0}min</div>
                </div>
                <div class="session-info">
                    <div class="session-course">${this.escape(session.courseCode || '')}</div>
                    <div class="session-title">${this.escape(session.topic)}</div>
                    <div class="session-meta">
                        <span><i class="fas fa-chalkboard-teacher"></i> ${this.escape(session.lecturerName || 'Unknown Lecturer')}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${this.escape(location)}</span>
                    </div>
                </div>
                <span class="session-status ${statusClass}">${session.status || 'unknown'}</span>
                <div class="session-actions">
                    <button class="btn btn-sm btn-outline" onclick="scheduleManager.showDetail('${session.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    ${session.status === 'upcoming'
? `
                        <button class="btn btn-sm btn-danger" onclick="scheduleManager.cancelBooking('${session.id}')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    `
: ''}
                </div>
            </div>
        `
  }

  showDetail (id) {
    const session = this.sessions.find(s => s.id === id)
    if (!session) return

    const date = new Date(`${session.date}T${session.time}`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    })

    const location = session.location || 'Online'

    this.sessionDetailContent.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Course</span>
                <span class="detail-value">${this.escape(session.courseCode || '')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Lecturer</span>
                <span class="detail-value"><i class="fas fa-chalkboard-teacher"></i> ${this.escape(session.lecturerName || 'Unknown')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date & Time</span>
                <span class="detail-value">${date} at ${this.formatTime(session.time)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Duration</span>
                <span class="detail-value">${session.duration || 0} minutes</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value">${(session.status || 'unknown').toUpperCase()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Location</span>
                <span class="detail-value">${this.escape(location)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Topic</span>
                <span class="detail-value">${this.escape(session.topic)}</span>
            </div>
        `

    this.sessionModal.classList.remove('hidden')
  }

  // 4. Update Cancel to DELETE from database instead of localStorage
  async cancelBooking (id) {
    if (confirm('Are you sure you want to cancel your booking for this session?')) {
      try {
        const response = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
        if (response.ok) {
          await this.loadSessions() // Refresh the data from the DB
          this.updateStats()
          this.applyFilters()
        } else {
          alert('Failed to cancel the booking. Please try again.')
        }
      } catch (error) {
        console.error('Error canceling booking:', error)
      }
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
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
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
    endOfNextWeek.setHours(23, 59, 59, 999)
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

// INITIALIZE ONLY IF IN BROWSER
if (typeof module === 'undefined') {
  const scheduleManager = new StudentScheduleManager()
  window.scheduleManager = scheduleManager
} else {
  module.exports = { StudentScheduleManager }
}

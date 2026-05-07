class StudentScheduleManager {
  constructor () {
    this.storageKey = 'sychro_consultations'
    this.userStorageKey = 'sychro_current_user'
    this.sessions = []
    this.filteredSessions = []
    this.currentStudent = null

    this.init()
  }

  init () {
    this.loadCurrentStudent()
    this.loadSessions()
    this.setupEventListeners()
    this.displayCurrentDate()
    this.updateStats()
    this.updateFilterOptions()
    this.render()
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

    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadSessions()
      this.updateStats()
      this.updateFilterOptions()
      this.render()
    })

    document.getElementById('close-session-modal').addEventListener('click', () => this.closeModal())
    this.sessionModal.addEventListener('click', (e) => {
      if (e.target === this.sessionModal) this.closeModal()
    })

    const menuBtn = document.getElementById('menu-toggle')
    const sideMenu = document.getElementById('side-menu')

    if (menuBtn && sideMenu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        sideMenu.classList.toggle('hidden')
      })

      document.addEventListener('click', (e) => {
        // Close menu if clicking outside of it
        if (!sideMenu.contains(e.target) && !menuBtn.contains(e.target)) {
          sideMenu.classList.add('hidden')
        }
      })
    }

    // Sign Out functionality
    const signOutBtn = document.querySelector('.sign-out')
    if (signOutBtn) {
      signOutBtn.addEventListener('click', (e) => {
        e.preventDefault()
        console.log('Clearing session and redirecting...')
        sessionStorage.removeItem(this.userStorageKey)
        localStorage.removeItem(this.userStorageKey)
        window.location.href = 'login.html'
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
      console.log('Bookings from Database:', dbBookings)

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
        // Search by Lecturer Name instead of Student Name
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
    const location = session.location || 'Not specified'

    return `
            <div class="session-card">
                <div class="session-time">
                    <div class="time">${timeDisplay}</div>
                    <div class="duration">${session.duration || 0}min</div>
                </div>
                <div class="session-info">
                    <div class="session-course">${this.escape(session.courseCode || '')} ${session.courseName ? '- ' + this.escape(session.courseName) : ''}</div>
                    <div class="session-title">${this.escape(session.topic || 'No topic specified')}</div>
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

    const content = document.getElementById('session-detail-content')

    // Build the HTML for the modal
    content.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Module:</span>
            <span class="detail-value">${this.escape(session.courseCode || session.module)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${this.escape(session.date)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">${this.escape(session.startTime || session.time)} - ${this.escape(session.endTime || '')}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value status-badge status-${session.status}">${session.status}</span>
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

    this.sessionModal.classList.remove('hidden')
  }

  async cancelBooking (sessionId) {
    // 1. Confirm with the user before deleting
    if (!confirm('Are you sure you want to cancel this consultation? This action cannot be undone.')) {
      return
    }

    // 2. Get the current user's email to verify ownership
    const currentUser = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user'))

    if (!currentUser || !currentUser.email) {
      alert('Error: You must be logged in to cancel a booking.')
      return
    }

    try {
      // 3. Call the backend DELETE route
      const response = await fetch(`/api/bookings/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentEmail: currentUser.email })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert('Consultation canceled successfully.')
        this.closeModal() // Close the popup
        await this.init() // Re-fetch bookings and update the dashboard
      } else {
        alert('Failed to cancel: ' + (result.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Cancellation Error:', error)
      alert('An error occurred while trying to cancel the booking.')
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
  // EXPORT FOR JEST TESTING
  module.exports = { StudentScheduleManager }
}

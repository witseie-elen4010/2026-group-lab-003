class LecturerScheduleManager {
    constructor() {
        this.storageKey = 'sychro_consultations';
        this.userStorageKey = 'sychro_current_user';
        this.sessions = [];
        this.filteredSessions = [];
        this.currentLecturer = null;

        this.init();
    }

    init() {
        this.loadCurrentLecturer();
        this.loadSessions();
        this.setupEventListeners();
        this.displayCurrentDate();
        this.updateStats();
        this.updateFilterOptions();
        this.render();
    }

    // DOM GETTERS

    get totalSessionsEl() { return document.getElementById('total-sessions'); }
    get totalJoinedEl() { return document.getElementById('total-joined'); }
    get upcomingCountEl() { return document.getElementById('upcoming-count'); }
    get completedTodayEl() { return document.getElementById('completed-today'); }
    get currentDateEl() { return document.getElementById('current-date'); }
    get statusFilter() { return document.getElementById('status-filter'); }
    get courseFilter() { return document.getElementById('course-filter'); }
    get dateFilter() { return document.getElementById('date-filter'); }
    get searchInput() { return document.getElementById('search-input'); }
    get scheduleList() { return document.getElementById('schedule-list'); }
    get emptyState() { return document.getElementById('empty-state'); }
    get sessionModal() { return document.getElementById('session-modal'); }
    get sessionDetailContent() { return document.getElementById('session-detail-content'); }

    // EVENT LISTENERS

    setupEventListeners() {
        this.statusFilter.addEventListener('change', () => this.handleFilterChange());
        this.courseFilter.addEventListener('change', () => this.handleFilterChange());
        this.dateFilter.addEventListener('change', () => this.handleFilterChange());
        this.searchInput.addEventListener('input', this.debounce(() => this.handleFilterChange(), 300));

        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadSessions();
            this.updateStats();
            this.updateFilterOptions();
            this.render();
        });

        document.getElementById('close-session-modal').addEventListener('click', () => this.closeModal());
        this.sessionModal.addEventListener('click', (e) => {
            if (e.target === this.sessionModal) this.closeModal();
        });
    }

    handleFilterChange() {
        this.applyFilters();
    }

    // DATA MANAGEMENT

    loadCurrentLecturer() {
        const sessionUser = sessionStorage.getItem(this.userStorageKey);
        if (sessionUser) {
            this.currentLecturer = JSON.parse(sessionUser);
            return;
        }

        const localUser = localStorage.getItem(this.userStorageKey);
        if (localUser) {
            this.currentLecturer = JSON.parse(localUser);
            return;
        }

        this.currentLecturer = null;
    }

    loadSessions() {
        const stored = localStorage.getItem(this.storageKey);
        const allSessions = stored ? JSON.parse(stored) : [];

        if (this.currentLecturer && this.currentLecturer.fullName) {
            this.sessions = allSessions.filter(session =>
                session.lecturerName === this.currentLecturer.fullName
            );
        } else if (this.currentLecturer && this.currentLecturer.email) {
            this.sessions = allSessions.filter(session =>
                session.lecturerEmail === this.currentLecturer.email
            );
        } else {
            this.sessions = allSessions;
        }
    }

    saveSessions() {
        const stored = localStorage.getItem(this.storageKey);
        const allSessions = stored ? JSON.parse(stored) : [];

        this.sessions.forEach(updatedSession => {
            const index = allSessions.findIndex(s => s.id === updatedSession.id);
            if (index !== -1) {
                allSessions[index] = updatedSession;
            }
        });

        localStorage.setItem(this.storageKey, JSON.stringify(allSessions));
    }

    // FILTERING

    applyFilters() {
        const status = this.statusFilter.value;
        const course = this.courseFilter.value;
        const date = this.dateFilter.value;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        this.filteredSessions = this.sessions.filter(session => {
            if (status !== 'all' && session.status !== status) return false;
            if (course !== 'all' && session.courseCode !== course) return false;

            if (date !== 'all') {
                const sessionDate = session.date;
                const today = new Date().toISOString().split('T')[0];
                const tomorrow = this.getTomorrow();

                if (date === 'today' && sessionDate !== today) return false;
                if (date === 'tomorrow' && sessionDate !== tomorrow) return false;
                if (date === 'this-week' && !this.isThisWeek(sessionDate)) return false;
                if (date === 'next-week' && !this.isNextWeek(sessionDate)) return false;
            }

            if (searchTerm) {
                const searchStr = `${session.studentName || ''} ${session.courseCode || ''} ${session.topic || ''}`.toLowerCase();
                if (!searchStr.includes(searchTerm)) return false;
            }

            return true;
        });

        this.filteredSessions.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA - dateB;
        });

        this.render();
    }

    updateFilterOptions() {
        const courses = [...new Set(this.sessions.map(s => s.courseCode).filter(Boolean))].sort();
        this.courseFilter.innerHTML = '<option value="all">All Courses</option>';
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            this.courseFilter.appendChild(option);
        });
    }

    // STATISTICS

    updateStats() {
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = this.sessions.filter(s => s.date === today);

        this.totalSessionsEl.textContent = todaySessions.length;
        this.totalJoinedEl.textContent = todaySessions.reduce((sum, s) => sum + (s.joinedStudents ? s.joinedStudents.length : 0), 0);
        this.upcomingCountEl.textContent = this.sessions.filter(s => (s.status === 'upcoming' || s.status === 'ongoing') && this.isThisWeek(s.date)).length;
        this.completedTodayEl.textContent = todaySessions.filter(s => s.status === 'completed').length;
    }

        // RENDERING

    displayCurrentDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }

    render() {
        if (this.filteredSessions.length === 0) {
            this.scheduleList.innerHTML = '';
            this.emptyState.classList.remove('hidden');
        } else {
            this.emptyState.classList.add('hidden');
            this.scheduleList.innerHTML = this.filteredSessions.map(s => this.renderSessionCard(s)).join('');
        }
    }

    renderSessionCard(session) {
        const timeDisplay = this.formatTime(session.time);
        const statusClass = `status-${session.status}`;
        const joinedStudents = session.joinedStudents || [];
        const location = session.location || 'Not specified';

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
                        <span><i class="fas fa-user"></i> ${this.escape(session.studentName || 'Unknown')}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${this.escape(location)}</span>
                    </div>
                    ${joinedStudents.length > 0 ? `
                        <div class="joined-students">
                            ${joinedStudents.map(s =>
                                `<div class="student-avatar" title="${this.escape(s)}">${s.split(' ').map(n => n[0]).join('')}</div>`
                            ).join('')}
                            <span class="student-count">${joinedStudents.length} joined</span>
                        </div>
                    ` : ''}
                </div>
                <span class="session-status ${statusClass}">${session.status || 'unknown'}</span>
                <div class="session-actions">
                    <button class="btn btn-sm btn-outline" onclick="scheduleManager.showDetail('${session.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    ${session.status === 'upcoming' ? `
                        <button class="btn btn-sm btn-danger" onclick="scheduleManager.cancelSession('${session.id}')">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                    ${session.status === 'ongoing' ? `
                        <button class="btn btn-sm btn-success" onclick="scheduleManager.completeSession('${session.id}')">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    showDetail(id) {
        const session = this.sessions.find(s => s.id === id);
        if (!session) return;

        const date = new Date(`${session.date}T${session.time}`).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        const joinedStudents = session.joinedStudents || [];
        const location = session.location || 'Not specified';

        this.sessionDetailContent.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Course</span>
                <span class="detail-value">${this.escape(session.courseCode || '')} ${session.courseName ? '- ' + this.escape(session.courseName) : ''}</span>
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
                <span class="detail-value">${this.escape(session.topic || 'No topic specified')}</span>
            </div>
            <div class="detail-students">
                <h4>Students Joined (${joinedStudents.length})</h4>
                ${joinedStudents.length > 0 ? `
                    <ul class="student-list">
                        ${joinedStudents.map(s => `<li><i class="fas fa-user-circle"></i> ${this.escape(s)}</li>`).join('')}
                    </ul>
                ` : '<p style="color: #888; font-size: 13px;">No students have joined yet.</p>'}
            </div>
        `;

        this.sessionModal.classList.remove('hidden');
    }

    closeModal() {
        this.sessionModal.classList.add('hidden');
    }

    cancelSession(id) {
        if (confirm('Cancel this session?')) {
            const session = this.sessions.find(s => s.id === id);
            if (session) {
                session.status = 'canceled';
                this.saveSessions();
                this.updateStats();
                this.applyFilters();
            }
        }
    }

    completeSession(id) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            session.status = 'completed';
            this.saveSessions();
            this.updateStats();
            this.applyFilters();
        }
    }

       // HELPERS

    formatTime(time) {
        if (!time) return '--:--';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${displayHour}:${minutes} ${period}`;
    }

    getTomorrow() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    isThisWeek(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return date >= startOfWeek && date <= endOfWeek;
    }

    isNextWeek(dateStr) {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const today = new Date();
        const startOfNextWeek = new Date(today);
        startOfNextWeek.setDate(today.getDate() - today.getDay() + 7);
        const endOfNextWeek = new Date(startOfNextWeek);
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
        endOfNextWeek.setHours(23, 59, 59, 999);
        return date >= startOfNextWeek && date <= endOfNextWeek;
    }

    escape(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
}

// INITIALIZE
const scheduleManager = new LecturerScheduleManager();
window.scheduleManager = scheduleManager;
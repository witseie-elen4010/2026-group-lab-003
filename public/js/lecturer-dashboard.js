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


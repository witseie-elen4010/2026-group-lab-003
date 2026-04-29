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
    
class StudentSessionJoiner {
    constructor() {
        this.storageKey = 'sychro_consultations';
        this.userStorageKey = 'sychro_current_user';
        this.sessions = [];
        this.filteredSessions = [];
        this.currentStudent = null;
        this.availableCourses = [];

        this.init();
    }

    init() {
        this.loadCurrentStudent();
        this.loadLocalSessions();
        this.setupEventListeners();
        this.updateFilterOptions();
        this.filterAndRender();
        this.loadCourseOptions();
        this.loadSessions();
    }

    // DOM getters
    get sessionsList() { return document.getElementById('sessions-list'); }
    get emptyState() { return document.getElementById('empty-state'); }
    get courseFilter() { return document.getElementById('course-filter'); }
    get searchInput() { return document.getElementById('search-input'); }

    setupEventListeners() {
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadSessions();
        });
        this.courseFilter.addEventListener('change', () => this.filterAndRender());
        this.searchInput.addEventListener('input', this.debounce(() => this.filterAndRender(), 300));
    }

    loadCurrentStudent() {
        const sessionUser = sessionStorage.getItem(this.userStorageKey);
        if (sessionUser) {
            this.currentStudent = JSON.parse(sessionUser);
        } else {
            const localUser = localStorage.getItem(this.userStorageKey);
            if (localUser) this.currentStudent = JSON.parse(localUser);
            else this.currentStudent = null;
        }
    }

    loadLocalSessions() {
        const stored = localStorage.getItem(this.storageKey);
        const allSessions = stored ? JSON.parse(stored) : [];
        this.sessions = allSessions
            .filter(s => s.status === 'upcoming' || s.status === 'ongoing')
            .map(s => ({
                ...s,
                source: 'local',
                maxStudents: Number(s.maxStudents) || Number(s.capacity) || 5,
                joinedStudents: s.joinedStudents || [],
                joinedStudentIds: s.joinedStudentIds || s.participantIDs || s.joinedStudents || []
            }));
    }

    async loadSessions() {
        if (typeof fetch !== 'function') return;

        try {
            const response = await fetch('/api/bookings?status=upcoming,ongoing');
            if (!response.ok) return;

            const bookings = await response.json();
            this.sessions = bookings
                .map(booking => this.mapBookingToSession(booking))
                .filter(session => this.isJoinablePeerSession(session));
            this.updateFilterOptions();
            this.filterAndRender();
        } catch (error) {
            console.error('Failed to load peer sessions:', error);
        }
    }

    async loadCourseOptions() {
        if (typeof fetch !== 'function') {
            this.availableCourses = this.collectSessionCourses();
            this.updateFilterOptions();
            return;
        }

        try {
            const response = await fetch('/api/bookings/form-data');
            if (!response.ok) return;

            const lecturers = await response.json();
            const courses = this.collectSessionCourses();
            lecturers.forEach(lecturer => {
                (lecturer.courses || []).forEach(course => courses.push(course));
                (lecturer.weeklySchedule || []).forEach(day => {
                    (day.slots || []).forEach(slot => {
                        if (slot.course) courses.push(slot.course);
                    });
                });
            });
            this.availableCourses = [...new Set(courses.filter(Boolean).map(String))].sort();
            this.updateFilterOptions();
        } catch (error) {
            this.availableCourses = this.collectSessionCourses();
            this.updateFilterOptions();
        }
    }

    collectSessionCourses() {
        return this.sessions.map(s => s.courseCode).filter(Boolean);
    }

    mapBookingToSession(booking) {
        const joinedStudentIds = booking.participantIDs || [];
        const joinedStudents = booking.participantNames || joinedStudentIds;
        return {
            id: booking._id || booking.id,
            source: 'api',
            courseCode: booking.module || booking.courseCode,
            date: booking.date,
            time: booking.startTime || booking.time,
            endTime: booking.endTime,
            duration: booking.duration || this.calculateDuration(booking.startTime, booking.endTime),
            status: booking.status || 'upcoming',
            studentName: booking.studentName || booking.studentId || 'Student',
            studentId: booking.studentId,
            topic: booking.topic || 'No topic',
            lecturerName: booking.lecturerName || booking.lecturerId || '',
            joinedStudents,
            joinedStudentIds,
            maxStudents: Number(booking.effectiveMaxStudents || booking.maxStudents) || 1,
            spacesLeft: Number.isFinite(Number(booking.spacesLeft)) ? Number(booking.spacesLeft) : undefined,
            venue: booking.venue || ''
        };
    }

    calculateDuration(start, end) {
        if (!start || !end) return '';
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        return ((endHour * 60) + endMinute) - ((startHour * 60) + startMinute);
    }

    isJoinablePeerSession(session) {
        if (!session.id || !['upcoming', 'ongoing'].includes(session.status)) return false;
        if (this.isSessionFull(session)) return false;
        if (this.hasSessionPassed(session)) return false;
        const currentIds = this.getCurrentStudentIds();
        if (currentIds.some(id => id && id === session.studentId)) return false;
        return true;
    }

    isSessionFull(session) {
        const joinedIds = session.joinedStudentIds || session.joinedStudents || [];
        const maxStudents = Number(session.maxStudents) || 1;
        const spacesLeft = Number.isFinite(Number(session.spacesLeft))
            ? Number(session.spacesLeft)
            : maxStudents - joinedIds.length;
        return spacesLeft <= 0;
    }

    hasSessionPassed(session) {
        if (!session.date) return false;
        const sessionEnd = session.endTime || session.time;
        const timestamp = new Date(`${session.date}T${sessionEnd}`).getTime();
        if (Number.isNaN(timestamp)) return false;
        return timestamp < Date.now();
    }

    getCurrentStudentIds() {
        if (!this.currentStudent) return [];
        return [
            this.currentStudent.email,
            this.currentStudent.id,
            this.currentStudent.idNumber,
            this.currentStudent.fullName,
            [this.currentStudent.name, this.currentStudent.surname].filter(Boolean).join(' ')
        ].filter(Boolean);
    }

    getCurrentStudentLabel() {
        if (!this.currentStudent) return '';
        return this.currentStudent.fullName ||
            [this.currentStudent.name, this.currentStudent.surname].filter(Boolean).join(' ') ||
            this.currentStudent.email ||
            this.currentStudent.idNumber ||
            '';
    }

    filterAndRender() {
        const course = this.courseFilter.value;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        this.filteredSessions = this.sessions.filter(session => {
            if (!this.isJoinablePeerSession(session)) return false;
            if (course !== 'all' && session.courseCode !== course) return false;
            if (searchTerm) {
                const searchStr = `${session.studentName} ${session.topic} ${session.courseCode} ${session.lecturerName} ${session.venue}`.toLowerCase();
                if (!searchStr.includes(searchTerm)) return false;
            }
            return true;
        });

        this.filteredSessions.sort((a, b) => this.compareSoonestSessions(a, b));
        this.render();
    }

    compareSoonestSessions(a, b) {
        if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
        if (b.status === 'ongoing' && a.status !== 'ongoing') return 1;
        return this.getSessionStartTime(a) - this.getSessionStartTime(b);
    }

    getSessionStartTime(session) {
        const timestamp = new Date(`${session.date}T${session.time}`).getTime();
        return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
    }

    updateFilterOptions() {
        const currentValue = this.courseFilter.value || 'all';
        const courses = [...new Set([...this.availableCourses, ...this.collectSessionCourses()].filter(Boolean))].sort();
        this.courseFilter.innerHTML = '<option value="all">All Courses</option>';
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            this.courseFilter.appendChild(option);
        });
        if (courses.includes(currentValue)) this.courseFilter.value = currentValue;
    }

    render() {
        if (this.filteredSessions.length === 0) {
            this.sessionsList.innerHTML = '';
            this.emptyState.classList.remove('hidden');
        } else {
            this.emptyState.classList.add('hidden');
            this.sessionsList.innerHTML = this.filteredSessions.map(s => this.renderCard(s)).join('');
        }
    }

    renderCard(session) {
        const dateObj = new Date(`${session.date}T${session.time}`);
        const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeDisplay = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const joinedStudents = session.joinedStudents || [];
        const joinedStudentIds = session.joinedStudentIds || joinedStudents;
        const totalJoined = joinedStudentIds.length;
        const maxStudents = Number(session.maxStudents) || 1;
        const spacesLeft = Number.isFinite(Number(session.spacesLeft))
            ? Math.max(Number(session.spacesLeft), 0)
            : Math.max(maxStudents - totalJoined, 0);
        const isFull = spacesLeft === 0;
        const alreadyJoined = this.getCurrentStudentIds().some(id => joinedStudentIds.includes(id) || joinedStudents.includes(id));

        return `
            <div class="session-card">
                <div class="session-time">
                    <div class="date">${dateDisplay}</div>
                    <div class="time">${timeDisplay}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.5)">${session.duration || ''}min</div>
                </div>
                <div class="session-info">
                    <div class="session-course">${this.escape(session.courseCode)}</div>
                    <div class="session-topic">${this.escape(session.topic || 'No topic')}</div>
                    <div class="session-owner">
                        <i class="fas fa-user-circle"></i> Created by ${this.escape(session.studentName)}
                        ${session.lecturerName ? ` with ${this.escape(session.lecturerName)}` : ''}
                    </div>
                    ${session.venue ? `<div class="session-owner"><i class="fas fa-location-dot"></i> ${this.escape(session.venue)}</div>` : ''}
                    <div class="attendees">
                        ${joinedStudents.slice(0, 4).map(name => 
                            `<div class="attendee-avatar" title="${this.escape(name)}">${this.escape(this.initials(name))}</div>`
                        ).join('')}
                        ${totalJoined > 4 ? `<div class="attendee-avatar">+${totalJoined - 4}</div>` : ''}
                        <span class="attendee-count">${totalJoined}/${maxStudents} joined</span>
                        <span class="space-count ${isFull ? 'full' : ''}">${spacesLeft} ${spacesLeft === 1 ? 'space' : 'spaces'} left</span>
                    </div>
                </div>
                <div class="join-btn">
                    ${alreadyJoined ? 
                        `<button class="btn btn-success btn-sm" disabled><i class="fas fa-check"></i> Joined</button>` :
                        isFull ?
                            `<button class="btn btn-sm btn-disabled" disabled><i class="fas fa-ban"></i> Full</button>` :
                            `<button class="btn btn-sm" onclick="studentJoiner.joinSession('${session.id}')"><i class="fas fa-plus"></i> Join</button>`
                    }
                </div>
            </div>
        `;
    }

    initials(name) {
        return String(name || '?').split(/\s+/).filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }

    async joinSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        if (!this.currentStudent || !this.getCurrentStudentLabel()) {
            alert('You must be logged in to join a session.');
            return;
        }

        const currentIds = this.getCurrentStudentIds();
        const joinedIds = session.joinedStudentIds || session.joinedStudents || [];
        if (currentIds.some(id => joinedIds.includes(id))) {
            alert('You are already in this session.');
            return;
        }

        const maxStudents = Number(session.maxStudents) || 1;
        if (joinedIds.length >= maxStudents) {
            alert('This session is already full.');
            return;
        }

        if (session.source === 'api') {
            await this.joinApiSession(session);
            return;
        }

        this.joinLocalSession(sessionId);
    }

    async joinApiSession(session) {
        const email = this.currentStudent.email || this.currentStudent.idNumber || this.getCurrentStudentLabel();
        try {
            const response = await fetch(`/api/bookings/${session.id}/join`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                alert(data.message || data.error || 'Failed to join session');
                return;
            }
            await this.loadSessions();
        } catch (error) {
            console.error('Failed to join session:', error);
            alert('Failed to join session');
        }
    }

    joinLocalSession(sessionId) {
        const allStored = localStorage.getItem(this.storageKey);
        if (!allStored) return;
        const allSessions = JSON.parse(allStored);
        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;

        const studentLabel = this.getCurrentStudentLabel();
        if (!session.joinedStudents) session.joinedStudents = [];
        if (session.joinedStudents.includes(studentLabel)) {
            alert('You are already in this session.');
            return;
        }
        const maxStudents = Number(session.maxStudents) || Number(session.capacity) || 5;
        if (session.joinedStudents.length >= maxStudents) {
            alert('This session is already full.');
            return;
        }

        session.joinedStudents.push(studentLabel);
        localStorage.setItem(this.storageKey, JSON.stringify(allSessions));
        this.loadLocalSessions();
        this.filterAndRender();
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
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

// Initialize
const studentJoiner = new StudentSessionJoiner();
window.studentJoiner = studentJoiner;

class StudentSessionJoiner {
    constructor() {
        this.storageKey = 'sychro_consultations';
        this.userStorageKey = 'sychro_current_user';
        this.sessions = [];
        this.filteredSessions = [];
        this.currentStudent = null;

        this.init();
    }

    init() {
        this.loadCurrentStudent();
        this.loadSessions();
        this.setupEventListeners();
        this.updateFilterOptions();
        this.render();
    }

    // DOM getters
    get sessionsList() { return document.getElementById('sessions-list'); }
    get emptyState() { return document.getElementById('empty-state'); }
    get courseFilter() { return document.getElementById('course-filter'); }
    get searchInput() { return document.getElementById('search-input'); }

    setupEventListeners() {
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadSessions();
            this.updateFilterOptions();
            this.render();
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

    loadSessions() {
        const stored = localStorage.getItem(this.storageKey);
        const allSessions = stored ? JSON.parse(stored) : [];
        // Show only upcoming/ongoing sessions, not canceled/completed
        this.sessions = allSessions.filter(s => s.status === 'upcoming' || s.status === 'ongoing');
    }

    filterAndRender() {
        const course = this.courseFilter.value;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        this.filteredSessions = this.sessions.filter(session => {
            if (course !== 'all' && session.courseCode !== course) return false;
            if (searchTerm) {
                const searchStr = `${session.studentName} ${session.topic} ${session.courseCode}`.toLowerCase();
                if (!searchStr.includes(searchTerm)) return false;
            }
            return true;
        });

        this.filteredSessions.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
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
        const totalJoined = joinedStudents.length;

        // Check if current student already joined
        const alreadyJoined = this.currentStudent && joinedStudents.includes(this.currentStudent.fullName);

        return `
            <div class="session-card">
                <div class="session-time">
                    <div class="date">${dateDisplay}</div>
                    <div class="time">${timeDisplay}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.5)">${session.duration}min</div>
                </div>
                <div class="session-info">
                    <div class="session-course">${this.escape(session.courseCode)}</div>
                    <div class="session-topic">${this.escape(session.topic || 'No topic')}</div>
                    <div class="session-owner">
                        <i class="fas fa-user-circle"></i> Created by ${this.escape(session.studentName)}
                        ${session.lecturerName ? ` with ${this.escape(session.lecturerName)}` : ''}
                    </div>
                    <div class="attendees">
                        ${joinedStudents.slice(0, 4).map(name => 
                            `<div class="attendee-avatar" title="${this.escape(name)}">${name.split(' ').map(n => n[0]).join('')}</div>`
                        ).join('')}
                        ${totalJoined > 4 ? `<div class="attendee-avatar">+${totalJoined - 4}</div>` : ''}
                        <span class="attendee-count">${totalJoined} joined</span>
                    </div>
                </div>
                <div class="join-btn">
                    ${alreadyJoined ? 
                        `<button class="btn btn-success btn-sm" disabled><i class="fas fa-check"></i> Joined</button>` :
                        `<button class="btn btn-sm" onclick="studentJoiner.joinSession('${session.id}')"><i class="fas fa-plus"></i> Join</button>`
                    }
                </div>
            </div>
        `;
    }

    joinSession(sessionId) {
        const allStored = localStorage.getItem(this.storageKey);
        if (!allStored) return;
        const allSessions = JSON.parse(allStored);

        const session = allSessions.find(s => s.id === sessionId);
        if (!session) return;

        if (!this.currentStudent || !this.currentStudent.fullName) {
            alert('You must be logged in to join a session.');
            return;
        }

        // Initialize joinedStudents if missing
        if (!session.joinedStudents) session.joinedStudents = [];

        if (session.joinedStudents.includes(this.currentStudent.fullName)) {
            alert('You are already in this session.');
            return;
        }

        session.joinedStudents.push(this.currentStudent.fullName);
        localStorage.setItem(this.storageKey, JSON.stringify(allSessions));
        this.loadSessions();
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
class StudentSessionJoiner {
    constructor() {
        this.storageKey = 'sychro_consultations';
        this.userStorageKey = 'sychro_current_user';
        this.sessions = [];
        this.filteredSessions = [];
        this.currentStudent = null;

        this.init();
    }

    async init() {
        this.loadCurrentStudent();
        await this.loadSessions();
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
        document.getElementById('refresh-btn').addEventListener('click', async () => {
            await this.loadSessions();
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

    async loadSessions() {
        try {
            const response = await fetch('/api/bookings?status=upcoming,ongoing');
            if (response.ok) {
                this.sessions = await response.json();
            } else {
                this.sessions = [];
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.sessions = [];
        }
    }

    filterAndRender() {
        const course = this.courseFilter.value;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        this.filteredSessions = this.sessions.filter(session => {
            if (course !== 'all' && session.module !== course) return false;
            if (searchTerm) {
                const searchStr = `${session.studentName} ${session.topic} ${session.module}`.toLowerCase();
                if (!searchStr.includes(searchTerm)) return false;
            }
            return true;
        });

        this.filteredSessions.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
        this.render();
    }

    updateFilterOptions() {
        const courses = [...new Set(this.sessions.map(s => s.module).filter(Boolean))].sort();
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
        const dateObj = new Date(`${session.date}T${session.startTime}`);
        const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeDisplay = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const joinedStudents = session.participantIDs || [];
        const totalJoined = joinedStudents.length;

        // Check if current student already joined
        const alreadyJoined = this.currentStudent && joinedStudents.includes(this.currentStudent.email);

        return `
            <div class="session-card">
                <div class="session-time">
                    <div class="date">${dateDisplay}</div>
                    <div class="time">${timeDisplay}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.5)">${this.escape(session.module || 'No module')}</div>
                </div>
                <div class="session-info">
                    <div class="session-course">${this.escape(session.module || 'No module')}</div>
                    <div class="session-topic">${this.escape(session.topic || 'No topic')}</div>
                    <div class="session-owner">
                        <i class="fas fa-user-circle"></i> Created by ${this.escape(session.studentId)}
                        ${session.lecturerId ? ` with ${this.escape(session.lecturerId)}` : ''}
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
                        `<button class="btn btn-sm" onclick="studentJoiner.joinSession('${session._id}')"><i class="fas fa-plus"></i> Join</button>`
                    }
                </div>
            </div>
        `;
    }

    async joinSession(sessionId) {
        if (!this.currentStudent || !this.currentStudent.email) {
            alert('You must be logged in to join a session.');
            return;
        }

        try {
            const response = await fetch(`/api/bookings/${sessionId}/join`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.currentStudent.email })
            });

            if (response.ok) {
                await this.loadSessions();
                this.filterAndRender();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to join session');
            }
        } catch (error) {
            console.error('Failed to join session:', error);
        }
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
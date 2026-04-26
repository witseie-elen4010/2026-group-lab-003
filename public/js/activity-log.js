class ActivityLogManager {
    constructor() {
        this.storageKey = 'activity_logs';
        this.pageSize = 15;
        this.currentPage = 1;
        this.activities = [];
        this.filteredActivities = [];
        this.autoRefreshInterval = null;

        this.init();
    }

    init() {
        this.loadActivities();
        this.setupEventListeners();
        this.updateStats();
        this.updateFilterOptions();
        this.render();
    }


    // DOM GETTERS 

    get totalActivitiesEl() { return document.getElementById('total-activities'); }
    get todayActivitiesEl() { return document.getElementById('today-activities'); }
    get createdCountEl() { return document.getElementById('created-count'); }
    get canceledCountEl() { return document.getElementById('canceled-count'); }
    get activeUsersEl() { return document.getElementById('active-users'); }
    get actionTypeFilter() { return document.getElementById('action-type-filter'); }
    get userFilter() { return document.getElementById('user-filter'); }
    get dateRangeFilter() { return document.getElementById('date-range-filter'); }
    get searchInput() { return document.getElementById('search-input'); }
    get customDateRange() { return document.getElementById('custom-date-range'); }
    get startDate() { return document.getElementById('start-date'); }
    get endDate() { return document.getElementById('end-date'); }
    get activityTimeline() { return document.getElementById('activity-timeline'); }
    get emptyState() { return document.getElementById('empty-state'); }
    get detailModal() { return document.getElementById('detail-modal'); }
    get detailContent() { return document.getElementById('detail-content'); }
    get currentPageSpan() { return document.getElementById('current-page'); }
    get totalPagesSpan() { return document.getElementById('total-pages'); }
    get prevPageBtn() { return document.getElementById('prev-page'); }
    get nextPageBtn() { return document.getElementById('next-page'); }

    // EVENT LISTENERS

    setupEventListeners() {
        this.actionTypeFilter.addEventListener('change', () => this.handleFilterChange());
        this.userFilter.addEventListener('change', () => this.handleFilterChange());
        this.dateRangeFilter.addEventListener('change', () => this.handleDateRangeChange());
        this.searchInput.addEventListener('input', this.debounce(() => this.handleFilterChange(), 300));

        document.getElementById('apply-date-range').addEventListener('click', () => this.handleFilterChange());
        document.getElementById('clear-filters-btn').addEventListener('click', () => this.clearFilters());
        document.getElementById('export-activity-btn').addEventListener('click', () => this.exportCSV());
        document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAll());
        document.getElementById('auto-refresh-toggle').addEventListener('click', () => this.toggleAutoRefresh());

        this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        this.nextPageBtn.addEventListener('click', () => this.changePage(1));

        document.getElementById('close-detail-modal').addEventListener('click', () => this.closeModal());
        this.detailModal.addEventListener('click', (e) => {
            if (e.target === this.detailModal) this.closeModal();
        });
    }

    handleFilterChange() {
        this.currentPage = 1;
        this.applyFilters();
    }

    handleDateRangeChange() {
        if (this.dateRangeFilter.value === 'custom') {
            this.customDateRange.classList.remove('hidden');
        } else {
            this.customDateRange.classList.add('hidden');
            this.handleFilterChange();
        }
    }

    // DATA MANAGEMENT

    loadActivities() {
        const stored = localStorage.getItem(this.storageKey);
        this.activities = stored ? JSON.parse(stored) : [];
    }

    saveActivities() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.activities));
    }

    logAction(type, description, metadata = {}) {
        const currentUser = this.getCurrentUser();

        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            type: type,
            description: description,
            user: currentUser.fullName || currentUser.email || 'Unknown User',
            userId: currentUser.id || null,
            timestamp: new Date().toISOString(),
            metadata: metadata
        };

        this.activities.unshift(entry);

        if (this.activities.length > 500) {
            this.activities = this.activities.slice(0, 500);
        }

        this.saveActivities();
        this.updateStats();
        this.updateFilterOptions();

        if (this.currentPage === 1) {
            this.render();
        }
    }

    getCurrentUser() {
        // Check sessionStorage first (cleared when browser closes)
        const sessionUser = sessionStorage.getItem('sychro_current_user');
        if (sessionUser) {
            return JSON.parse(sessionUser);
        }

        // Check localStorage (persists across sessions)
        const localUser = localStorage.getItem('sychro_current_user');
        if (localUser) {
            return JSON.parse(localUser);
        }

        return { fullName: 'System', email: 'system', id: null };
    }

    clearAll() {
        if (confirm('Delete ALL activity logs? This cannot be undone.')) {
            this.activities = [];
            this.saveActivities();
            this.updateStats();
            this.updateFilterOptions();
            this.render();
        }
    }

    // FILTERING

    applyFilters() {
        const actionType = this.actionTypeFilter.value;
        const user = this.userFilter.value;
        const dateRange = this.dateRangeFilter.value;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        this.filteredActivities = this.activities.filter(activity => {
            if (actionType !== 'all' && activity.type !== actionType) return false;
            if (user !== 'all' && activity.user !== user) return false;

            if (dateRange !== 'all') {
                const activityDate = new Date(activity.timestamp);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (dateRange === 'today' && activityDate < today) return false;
                if (dateRange === 'yesterday') {
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    if (activityDate < yesterday || activityDate >= today) return false;
                }
                if (dateRange === 'last7') {
                    const last7 = new Date(today);
                    last7.setDate(last7.getDate() - 7);
                    if (activityDate < last7) return false;
                }
                if (dateRange === 'last30') {
                    const last30 = new Date(today);
                    last30.setDate(last30.getDate() - 30);
                    if (activityDate < last30) return false;
                }
                if (dateRange === 'custom' && this.startDate.value && this.endDate.value) {
                    const start = new Date(this.startDate.value);
                    const end = new Date(this.endDate.value);
                    end.setHours(23, 59, 59, 999);
                    if (activityDate < start || activityDate > end) return false;
                }
            }

            if (searchTerm) {
                const searchStr = (activity.description + ' ' + activity.user).toLowerCase();
                if (!searchStr.includes(searchTerm)) return false;
            }

            return true;
        });

        this.render();
    }

    clearFilters() {
        this.actionTypeFilter.value = 'all';
        this.userFilter.value = 'all';
        this.dateRangeFilter.value = 'all';
        this.searchInput.value = '';
        this.customDateRange.classList.add('hidden');
        this.currentPage = 1;
        this.applyFilters();
    }

    updateFilterOptions() {
        const users = [...new Set(this.activities.map(a => a.user))].sort();
        this.userFilter.innerHTML = '<option value="all">All Users</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            this.userFilter.appendChild(option);
        });
    }

    // STATISTICS

    updateStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayActivities = this.activities.filter(a => new Date(a.timestamp) >= today);
        const uniqueUsersToday = [...new Set(todayActivities.map(a => a.user))];

        if (this.totalActivitiesEl) this.totalActivitiesEl.textContent = this.activities.length;
        if (this.todayActivitiesEl) this.todayActivitiesEl.textContent = todayActivities.length;
        if (this.createdCountEl) this.createdCountEl.textContent = this.activities.filter(a => a.type === 'created').length;
        if (this.canceledCountEl) this.canceledCountEl.textContent = this.activities.filter(a => a.type === 'canceled').length;
        if (this.activeUsersEl) this.activeUsersEl.textContent = uniqueUsersToday.length;
    }

    // RENDERING

    render() {
        const totalPages = Math.ceil(this.filteredActivities.length / this.pageSize) || 1;
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = this.filteredActivities.slice(start, start + this.pageSize);

        if (this.filteredActivities.length === 0) {
            this.activityTimeline.innerHTML = '';
            this.emptyState.classList.remove('hidden');
        } else {
            this.emptyState.classList.add('hidden');
            this.activityTimeline.innerHTML = pageData.map(a => this.renderEntry(a)).join('');
        }

        this.currentPageSpan.textContent = this.currentPage;
        this.totalPagesSpan.textContent = totalPages;
        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = this.currentPage >= totalPages;
    }

    renderEntry(activity) {
        const time = this.formatTime(activity.timestamp);
        const iconClass = this.getIconClass(activity.type);
        const typeClass = `activity-type-${activity.type}`;

        return `
            <div class="activity-entry ${typeClass}">
                <div class="activity-icon ${iconClass}">
                    <i class="fas ${this.getIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-description">${this.escape(activity.description)}</div>
                    <div class="activity-meta">
                        <span><i class="far fa-clock"></i> ${time}</span>
                        <span><i class="far fa-user"></i> ${this.escape(activity.user)}</span>
                    </div>
                </div>
                <div class="activity-actions-cell">
                    <button class="btn-icon" onclick="activityLog.showDetail('${activity.id}')" title="View details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>
        `;
    }

    showDetail(id) {
        const activity = this.activities.find(a => a.id === id);
        if (!activity) return;

        const time = new Date(activity.timestamp).toLocaleString();

        this.detailContent.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Action</span>
                <span class="detail-value">${activity.type.toUpperCase()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description</span>
                <span class="detail-value">${this.escape(activity.description)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">User</span>
                <span class="detail-value">${this.escape(activity.user)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Timestamp</span>
                <span class="detail-value">${time}</span>
            </div>
        `;

        this.detailModal.classList.remove('hidden');
    }

    closeModal() {
        this.detailModal.classList.add('hidden');
    }

    // PAGINATION

    changePage(delta) {
        const totalPages = Math.ceil(this.filteredActivities.length / this.pageSize) || 1;
        const newPage = this.currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.render();
        }
    }

    // EXPORT

    exportCSV() {
        const headers = ['Timestamp', 'Type', 'User', 'Description'];
        const rows = this.filteredActivities.map(a => [
            new Date(a.timestamp).toLocaleString(),
            a.type,
            a.user,
            a.description
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // AUTO-REFRESH

    toggleAutoRefresh() {
        const btn = document.getElementById('auto-refresh-toggle');
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            btn.classList.remove('active');
            btn.querySelector('span').textContent = 'Auto-refresh';
        } else {
            this.autoRefreshInterval = setInterval(() => {
                this.loadActivities();
                this.updateStats();
                this.updateFilterOptions();
                this.applyFilters();
            }, 10000);
            btn.classList.add('active');
            btn.querySelector('span').textContent = 'Auto-refresh ON';
        }
    }

    // HELPERS

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getIcon(type) {
        const icons = {
            created: 'fa-plus-circle',
            joined: 'fa-sign-in-alt',
            canceled: 'fa-times-circle'
        };
        return icons[type] || 'fa-circle';
    }

    getIconClass(type) {
        const classes = {
            created: 'icon-create',
            joined: 'icon-join',
            canceled: 'icon-cancel'
        };
        return classes[type] || 'icon-filter';
    }

    escape(str) {
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

const activityLog = new ActivityLogManager();
window.activityLog = activityLog;
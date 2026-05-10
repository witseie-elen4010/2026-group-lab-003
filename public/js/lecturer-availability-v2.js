// ============================================================
// Synchro v2 — Day-Based Availability Setup
// Lecturers set daily time ranges (e.g., "Mon 09:00–16:00")
// The system auto-generates booking slots from these ranges.
// Supports MULTIPLE time slots per day.
// ============================================================

const LECTURER_EMAIL_KEY = 'lecturerEmail';
const DAYS = [
  { id: 'mon', label: 'Mon', dayOfWeek: 1 },
  { id: 'tue', label: 'Tue', dayOfWeek: 2 },
  { id: 'wed', label: 'Wed', dayOfWeek: 3 },
  { id: 'thu', label: 'Thu', dayOfWeek: 4 },
  { id: 'fri', label: 'Fri', dayOfWeek: 5 }
];

document.addEventListener('DOMContentLoaded', () => {
  // --- Grab DOM refs ---
  const form = document.getElementById('availabilityForm');
  const resetBtn = document.getElementById('resetBtn');
  const saveBtn = document.getElementById('saveBtn');
  const defaultDuration = document.getElementById('defaultDuration');
  const slotCapacity = document.getElementById('slotCapacity');
  const dailySessionLimit = document.getElementById('dailySessionLimit');
  const previewEl = document.getElementById('preview');
  const courseCheckboxes = () => document.querySelectorAll('.course-select');


  // --- Load saved availability on startup ---
  loadAvailability();

  // --- Attach events ---
  form.addEventListener('submit', saveAvailability);
  resetBtn.addEventListener('click', resetForm);
  
  // Live preview on any change
  form.addEventListener('change', updatePreview);
  form.addEventListener('input', updatePreview);

  // --- Wire up "Add Slot" buttons ---
  document.querySelectorAll('.add-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dayCard = btn.closest('.day-card');
      const dayId = dayCard.dataset.day;
      addSlotRow(dayId);
      updatePreview();
    });
  });

  // --- Toggle day: enable/disable ALL time inputs in the card ---
  DAYS.forEach(day => {
    const toggle = document.getElementById(`toggle-${day.id}`);
    toggle.addEventListener('change', () => {
      const card = toggle.closest('.day-card');
      const enabled = toggle.checked;
      const inputs = card.querySelectorAll('.slot-start, .slot-end');
      inputs.forEach(inp => { inp.disabled = !enabled; });
      
      if (enabled) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
      
      updatePreview();
    });
  });

  // =============================================================
  //  addSlotRow — Append a new time-slot-row to a day's container
  // =============================================================
  function addSlotRow(dayId, startVal, endVal) {
    const container = document.querySelector(`.day-slots-container[data-day="${dayId}"]`);
    const row = document.createElement('div');
    row.className = 'time-slot-row';

    row.innerHTML = `
      <div class="time-pair">
        <div class="time-field">
          <label>From</label>
          <input type="time" class="form-control-minimal time-input slot-start" value="${startVal || '09:00'}">
        </div>
        <div class="time-field">
          <label>To</label>
          <input type="time" class="form-control-minimal time-input slot-end" value="${endVal || '16:00'}">
        </div>
      </div>
      <button type="button" class="remove-slot-btn" title="Remove slot">&times;</button>
    `;

    // Respect the current toggle state
    const toggle = document.getElementById(`toggle-${dayId}`);
    const enabled = toggle.checked;
    const inputs = row.querySelectorAll('.slot-start, .slot-end');
    inputs.forEach(inp => { inp.disabled = !enabled; });

    // Wire remove button
    const removeBtn = row.querySelector('.remove-slot-btn');
    removeBtn.addEventListener('click', () => {
      removeSlotRow(removeBtn);
    });

    container.appendChild(row);
    refreshRemoveButtons();
  }

  // =============================================================
  //  removeSlotRow — Remove a specific slot row
  // =============================================================
  function removeSlotRow(btn) {
    const row = btn.closest('.time-slot-row');
    const container = row.closest('.day-slots-container');
    row.remove();
    refreshRemoveButtons();
    updatePreview();
  }

  // =============================================================
  //  refreshRemoveButtons — Show/hide × buttons based on count
  // =============================================================
  function refreshRemoveButtons() {
    document.querySelectorAll('.day-slots-container').forEach(container => {
      const rows = container.querySelectorAll('.time-slot-row');
      rows.forEach((row, idx) => {
        const btn = row.querySelector('.remove-slot-btn');
        if (btn) {
          btn.style.display = rows.length > 1 ? '' : 'none';
        }
      });
    });
  }

  // =============================================================
  //  getDayData — Collect all slot rows per day
  // =============================================================
  function getDayData() {
    const data = [];
    DAYS.forEach(day => {
      const active = document.getElementById(`toggle-${day.id}`).checked;
      const container = document.querySelector(`.day-slots-container[data-day="${day.id}"]`);
      const slots = [];
      if (container) {
        container.querySelectorAll('.time-slot-row').forEach(row => {
          const start = row.querySelector('.slot-start').value;
          const end = row.querySelector('.slot-end').value;
          slots.push({ start, end });
        });
      }
      data.push({ dayOfWeek: day.dayOfWeek, active, slots });
    });
    return data;
  }

  // =============================================================
  //  getSelectedCourses — Collect checked course values
  // =============================================================
  function getSelectedCourses() {
    return Array.from(document.querySelectorAll('.course-select:checked')).map(cb => cb.value);
  }

  // =============================================================
  //  updatePreview — Live preview of all time ranges
  // =============================================================
  function updatePreview() {
    const days = getDayData();
    const dur = parseInt(defaultDuration.value, 10);
    const cap = slotCapacity.value || 1;
    const dLimit = dailySessionLimit.value || 10;
    const courses = getSelectedCourses();

    const activeDays = days.filter(d => d.active);

    let html = '';
    if (activeDays.length === 0 && courses.length === 0) {
      html = '<span style="color: #94a3b8;">No availability set. Select courses and toggle days.</span>';
    } else {
      // Show selected courses
      if (courses.length > 0) {
        html += `<div style="font-weight: 700; margin-bottom: 10px; color: var(--navy-blue);">📚 ${courses.join(', ')}</div>`;
      }
      if (activeDays.length > 0) {
        html += `<div style="font-weight: 700; margin-bottom: 12px; color: var(--navy-blue);">✅ ${activeDays.length} day(s) active</div>`;
        activeDays.forEach(d => {
          const dayLabel = DAYS.find(day => day.dayOfWeek === d.dayOfWeek)?.label || d.dayOfWeek;
          
          // Calculate total slots across all ranges for this day
          let dayTotalSlots = 0;
          let rangesHtml = '';
          d.slots.forEach(slot => {
            if (slot.start && slot.end && slot.start < slot.end) {
              const startMins = timeToMinutes(slot.start);
              const endMins = timeToMinutes(slot.end);
              const slotCount = Math.floor((endMins - startMins) / dur);
              dayTotalSlots += slotCount;
              rangesHtml += `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; padding: 6px 12px; background: #f8fafc; border-radius: 10px;">
                <span style="color: var(--navy-blue);">${slot.start} – ${slot.end}</span>
                <span style="color: #64748b; font-size: 0.85rem;">→ ${slotCount} slots × ${dur}min</span>
              </div>`;
            }
          });
          
          html += `<div style="margin-bottom: 8px;">
            <div style="font-weight: 700; color: var(--gold-accent); margin-bottom: 4px;">${dayLabel}</div>
            ${rangesHtml || '<span style="color: #94a3b8; font-size:0.9rem;">No valid ranges</span>'}
          </div>`;
        });
      }
      html += `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">`;
      html += `<div style="display: flex; gap: 24px; font-size: 0.9rem; color: #475569;">
        <span>👥 <strong>${cap}</strong> student(s)/slot</span>
        <span>📅 <strong>${dLimit}</strong> max/day</span>
      </div>`;
    }

    previewEl.innerHTML = html;
  }

  // =============================================================
  //  saveAvailability — Save all day slots to the server
  // =============================================================
  async function saveAvailability(e) {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const days = getDayData();
    const weeklySchedule = [];

    days.forEach(d => {
      const validSlots = d.slots.filter(s => s.active !== false && s.start && s.end && s.start < s.end);
      if (d.active && validSlots.length > 0) {
        weeklySchedule.push({
          dayOfWeek: d.dayOfWeek,
          slots: validSlots.map(s => ({ start: s.start, end: s.end }))
        });
      }
    });

    const courses = getSelectedCourses();
    if (courses.length === 0) {
      saveBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Select at least one course';
      saveBtn.style.background = '#dc2626';
      setTimeout(() => {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        saveBtn.style.background = '';
        saveBtn.disabled = false;
      }, 2000);
      return;
    }

    const lecturerEmail = localStorage.getItem(LECTURER_EMAIL_KEY) || 'test@lecturer.com';
    const payload = {
      defaultDuration: parseInt(defaultDuration.value, 10) || 30,
      slotCapacity: parseInt(slotCapacity.value, 10) || 1,
      dailySessionLimit: parseInt(dailySessionLimit.value, 10) || 10,
      courses,
      weeklySchedule
    };

    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lecturer-Email': lecturerEmail
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        saveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Saved!';
        saveBtn.style.background = '#16a34a';
        setTimeout(() => {
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
          saveBtn.style.background = '';
          saveBtn.disabled = false;
        }, 2000);
      } else {
        throw new Error(`Server responded ${res.status}`);
      }
    } catch (err) {
      console.error('❌ Save failed:', err);
      saveBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed — Try Again';
      saveBtn.style.background = '#dc2626';
      setTimeout(() => {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        saveBtn.style.background = '';
        saveBtn.disabled = false;
      }, 3000);
    }
  }

  // =============================================================
  //  loadAvailability — Load saved data and populate the form
  // =============================================================
  async function loadAvailability() {
    const lecturerEmail = localStorage.getItem(LECTURER_EMAIL_KEY) || 'test@lecturer.com';

    try {
      const res = await fetch('/api/availability', {
        headers: { 'X-Lecturer-Email': lecturerEmail }
      });
      const data = await res.json();

      if (data) {
        // Fill global settings
        if (data.defaultDuration) defaultDuration.value = data.defaultDuration;
        if (data.slotCapacity) slotCapacity.value = data.slotCapacity;
        if (data.dailySessionLimit) dailySessionLimit.value = data.dailySessionLimit;

        // Restore selected courses
        if (data.courses && Array.isArray(data.courses)) {
          document.querySelectorAll('.course-select').forEach(cb => {
            cb.checked = data.courses.includes(cb.value);
          });
        }

        if (data.weeklySchedule) {
          // Map saved day data back to the form
          data.weeklySchedule.forEach(dayEntry => {
          const dayConfig = DAYS.find(d => d.dayOfWeek === dayEntry.dayOfWeek);
          if (!dayConfig || !dayEntry.slots || dayEntry.slots.length === 0) return;

          const toggle = document.getElementById(`toggle-${dayConfig.id}`);
          const card = toggle.closest('.day-card');
          const container = document.querySelector(`.day-slots-container[data-day="${dayConfig.id}"]`);

          // Clear existing slots (except keep the first row to reuse)
          const existingRows = container.querySelectorAll('.time-slot-row');
          // Keep the first row, remove the rest
          existingRows.forEach((row, idx) => {
            if (idx > 0) row.remove();
          });

          // Populate the first row with the first saved slot
          const firstRow = container.querySelector('.time-slot-row');
          if (firstRow) {
            firstRow.querySelector('.slot-start').value = dayEntry.slots[0].start || '';
            firstRow.querySelector('.slot-end').value = dayEntry.slots[0].end || '';
          }

          // Add rows for any additional saved slots
          for (let i = 1; i < dayEntry.slots.length; i++) {
            addSlotRow(dayConfig.id, dayEntry.slots[i].start, dayEntry.slots[i].end);
          }

          // Activate the day
          toggle.checked = true;
          const inputs = card.querySelectorAll('.slot-start, .slot-end');
          inputs.forEach(inp => { inp.disabled = false; });
          card.classList.add('active');
        });
        } // end if weeklySchedule
      } // end if data
    } catch (err) {
      console.log('No saved data found, using defaults');
    }

    refreshRemoveButtons();
    updatePreview();
  }

  // =============================================================
  //  resetForm — Reset everything to defaults
  // =============================================================
  function resetForm() {
    if (!confirm('Reset all availability to defaults?')) return;

    DAYS.forEach(day => {
      document.getElementById(`toggle-${day.id}`).checked = false;
      const container = document.querySelector(`.day-slots-container[data-day="${day.id}"]`);
      // Remove all rows except the first
      const rows = container.querySelectorAll('.time-slot-row');
      rows.forEach((row, idx) => {
        if (idx > 0) row.remove();
      });
      // Reset the first row
      const firstRow = container.querySelector('.time-slot-row');
      if (firstRow) {
        firstRow.querySelector('.slot-start').value = '09:00';
        firstRow.querySelector('.slot-end').value = '16:00';
        firstRow.querySelector('.slot-start').disabled = true;
        firstRow.querySelector('.slot-end').disabled = true;
      }
      const card = document.getElementById(`toggle-${day.id}`).closest('.day-card');
      card.classList.remove('active');
    });
    defaultDuration.value = 30;
    slotCapacity.value = 1;
    dailySessionLimit.value = 10;

    refreshRemoveButtons();
    updatePreview();
  }

  // =============================================================
  //  Utility
  // =============================================================
  function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Initial preview
  updatePreview();
  refreshRemoveButtons();
});

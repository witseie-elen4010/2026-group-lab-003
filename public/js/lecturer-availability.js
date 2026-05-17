// Fixed: Slots load on page open
const storedLecturer = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user') || '{}');
const lecturerId = storedLecturer.idNumber || storedLecturer.email || 'test@lecturer.com';
const lecturerName = [storedLecturer.name, storedLecturer.surname].filter(Boolean).join(' ') || 'Unknown Lecturer';
const msg = document.getElementById('message');

const dayNames = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday'
};

const dayLabels = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday'
};

// Remember last used values for auto-fill across days
let lastSlotValues = { course: '', venue: '', maxStudents: '' };

// Stores slot IDs that have at least one booking — used to disable Edit button
let bookedSlotIds = [];

// Load existing availability on page load
loadAvailability();

// Add event listeners for all add slot buttons
document.querySelectorAll('.add-slot-btn').forEach(btn => {
  btn.addEventListener('click', handleAddSlot);
});

// Settings dropdown toggle
const settingsBtn = document.getElementById('settings-btn');
const settingsDropdown = document.getElementById('settings-dropdown');

if (settingsBtn && settingsDropdown) {
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
      settingsDropdown.classList.add('hidden');
    }
  });
}

// "Fill All Days" button - applies last used values to all forms
const fillAllBtn = document.getElementById('fill-all-btn');
if (fillAllBtn) {
  fillAllBtn.addEventListener('click', () => {
    if (!lastSlotValues.course && !lastSlotValues.venue && !lastSlotValues.maxStudents) {
      showMessage('Add a slot first to save details for filling other days', 'error');
      return;
    }
    document.querySelectorAll('.day-card').forEach(card => {
      const courseInput = card.querySelector('.slot-course');
      const venueInput = card.querySelector('.slot-venue');
      const maxInput = card.querySelector('.slot-max-students');
      if (courseInput) courseInput.value = lastSlotValues.course;
      if (venueInput) venueInput.value = lastSlotValues.venue;
      if (maxInput) maxInput.value = lastSlotValues.maxStudents;
      // Highlight
      card.classList.add('day-card-highlight');
      setTimeout(() => card.classList.remove('day-card-highlight'), 1500);
    });
    showMessage(`Filled all days with: ${lastSlotValues.course}, ${lastSlotValues.venue}, Max ${lastSlotValues.maxStudents}`, 'success');
  });
}

// Remove any existing floating dropdown from the DOM
function removeFloatingDropdown() {
  const existing = document.getElementById('floating-copy-dropdown');
  if (existing) existing.remove();
}

async function loadAvailability() {
  try {
    const res = await fetch('/api/availability', {
      headers: {
        'X-Lecturer-Id': lecturerId,
        'X-Lecturer-Name': lecturerName
      }
    });
    const data = await res.json();

    if (data.success && data.availability) {
      bookedSlotIds = data.bookedSlotIds || [];
      renderAllSlots(data.availability.weeklySchedule || []);
      // Auto-fill last used values on all forms
      autoFillLastUsed();
    }
  } catch (error) {
    console.error('Error loading availability:', error);
  }
}

function renderAllSlots(weeklySchedule) {
  // Clear all slots lists
  Object.values(dayNames).forEach(day => {
    const slotsList = document.getElementById(`slots-${day}`);
    if (slotsList) {
      slotsList.innerHTML = '<div class="no-slots">No slots added yet</div>';
    }
  });

  // Render slots for each day
  weeklySchedule.forEach(daySchedule => {
    const dayName = dayNames[daySchedule.dayOfWeek];
    if (dayName && daySchedule.slots) {
      renderSlotsForDay(daySchedule.dayOfWeek, daySchedule.slots);
    }
  });
}

function renderSlotsForDay(dayOfWeek, slots) {
  const dayName = dayNames[dayOfWeek];
  const slotsList = document.getElementById(`slots-${dayName}`);

  if (!slotsList) return;

  if (!slots || slots.length === 0) {
    slotsList.innerHTML = '<div class="no-slots">No slots added yet</div>';
    return;
  }

  slotsList.innerHTML = '';

  slots.forEach(slot => {
    const slotItem = document.createElement('div');
    slotItem.className = 'slot-item';
    slotItem.dataset.slotId = slot._id;

    const hasBookings = bookedSlotIds.includes(slot._id.toString());

    slotItem.innerHTML = `
      <div class="slot-info">
        <div class="slot-time">${formatTime(slot.start)} - ${formatTime(slot.end)}</div>
        <div class="slot-details">Duration: <span>${slot.duration} min</span></div>
        <div class="slot-details">Course: <span>${slot.course}</span></div>
        <div class="slot-details">Venue: <span>${slot.venue || 'Not specified'}</span></div>
        <div class="slot-details">Max Students: <span>${slot.maxStudents}</span></div>
      </div>
      <div class="slot-actions">
        <button class="edit-slot-btn${hasBookings ? ' disabled' : ''}" data-day="${dayOfWeek}" data-slot-id="${slot._id}" data-course="${slot.course}" data-venue="${slot.venue || ''}" data-max="${slot.maxStudents}" data-start="${slot.start}" data-end="${slot.end}"${hasBookings ? ' disabled' : ''} title="${hasBookings ? 'Cannot edit — students have already booked this slot' : 'Edit this slot'}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="copy-slot-btn" data-day="${dayOfWeek}" data-slot-id="${slot._id}" data-course="${slot.course}" data-venue="${slot.venue || ''}" data-max="${slot.maxStudents}" data-start="${slot.start}" data-end="${slot.end}" title="Copy this slot to another day">
          <i class="bi bi-files"></i> Copy
        </button>
        <button class="cancel-slot-btn" data-day="${dayOfWeek}" data-slot-id="${slot._id}">Cancel</button>
      </div>
    `;

    // Attach click handler DIRECTLY to the edit button (most reliable approach)
    const editBtn = slotItem.querySelector('.edit-slot-btn');
    if (editBtn && !hasBookings) {
      editBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        handleEditSlot(this);
      });
    }

    slotsList.appendChild(slotItem);
  });

  // Add event listeners to cancel buttons
  slotsList.querySelectorAll('.cancel-slot-btn').forEach(btn => {
    btn.addEventListener('click', handleCancelSlot);
  });

  // Add event listeners to copy buttons
  slotsList.querySelectorAll('.copy-slot-btn').forEach(btn => {
    btn.addEventListener('click', handleCopySlotClick);
  });
}

function formatTime(timeStr) {
  // Convert "09:00" to "9:00 AM"
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function calculateDuration(start, end) {
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  const durationHours = endHours - startHours;
  const durationMinutes = endMinutes - startMinutes;
  return durationHours * 60 + durationMinutes;
}

// Check if a new time range overlaps with any existing slots on the same day
// A lecturer cannot be in two places at once
function hasTimeConflict(existingSlots, newStart, newEnd) {
  if (!existingSlots || existingSlots.length === 0) return false;
  return existingSlots.some(slot => {
    return newStart < slot.end && newEnd > slot.start;
  });
}

// Get all existing slots for a given day from the currently rendered DOM
function getExistingSlotsForDay(dayOfWeek) {
  const dayName = dayNames[dayOfWeek];
  const slotsList = document.getElementById(`slots-${dayName}`);
  if (!slotsList) return [];

  const slotItems = slotsList.querySelectorAll('.slot-item');
  return Array.from(slotItems).map(item => {
    const timeText = item.querySelector('.slot-time')?.textContent || '';
    // Parse "9:00 AM - 10:30 AM" back to "09:00", "10:30"
    const parts = timeText.split(' - ');
    return {
      start: parseDisplayTimeTo24h(parts[0]),
      end: parseDisplayTimeTo24h(parts[1])
    };
  }).filter(s => s.start && s.end);
}

// Convert "9:00 AM" to "09:00"
function parseDisplayTimeTo24h(displayTime) {
  if (!displayTime) return '';
  const match = displayTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '';
  let hour = parseInt(match[1]);
  const min = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

async function handleAddSlot(e) {
  const dayOfWeek = parseInt(e.target.dataset.day);
  const dayCard = e.target.closest('.day-card');

  const start = dayCard.querySelector('.slot-start').value;
  const end = dayCard.querySelector('.slot-end').value;
  const course = dayCard.querySelector('.slot-course').value.trim();
  const venue = dayCard.querySelector('.slot-venue').value.trim();
  const maxStudents = parseInt(dayCard.querySelector('.slot-max-students').value);

  // Validation
  if (!start || !end || !course || !venue || !maxStudents) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  if (maxStudents < 1) {
    showMessage('Max students must be at least 1', 'error');
    return;
  }

  // Calculate duration from start and end times
  const duration = calculateDuration(start, end);
  if (duration < 15) {
    showMessage('Duration must be at least 15 minutes', 'error');
    return;
  }

  // Client-side time conflict check — lecturer cannot be in two places at once
  const existingSlots = getExistingSlotsForDay(dayOfWeek);
  if (hasTimeConflict(existingSlots, start, end)) {
    showMessage('Time conflict: This time overlaps with an existing slot on ' + dayLabels[dayOfWeek] + '. A lecturer cannot be in two places at once.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/availability/slot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lecturer-Id': lecturerId,
        'X-Lecturer-Name': lecturerName
      },
      body: JSON.stringify({
        dayOfWeek,
        start,
        end,
        duration,
        course,
        venue,
        maxStudents
      })
    });

    const data = await res.json();

    if (data.success) {
      showMessage('Slot added successfully', 'success');

      // Remember these values for auto-fill on other days
      lastSlotValues.course = course;
      lastSlotValues.venue = venue;
      lastSlotValues.maxStudents = maxStudents;

      // Clear only the time fields, keep course/venue/max for quick next entry
      dayCard.querySelector('.slot-start').value = '';
      dayCard.querySelector('.slot-end').value = '';
      dayCard.querySelector('.slot-course').value = lastSlotValues.course;
      dayCard.querySelector('.slot-venue').value = lastSlotValues.venue;
      dayCard.querySelector('.slot-max-students').value = lastSlotValues.maxStudents;
      // Reload availability
      loadAvailability();
    } else {
      showMessage(data.message || 'Error adding slot', 'error');
    }
  } catch (error) {
    console.error('Error adding slot:', error);
    showMessage('Error adding slot', 'error');
  }
}

async function handleCancelSlot(e) {
  const dayOfWeek = parseInt(e.target.dataset.day);
  const slotId = e.target.dataset.slotId;

  if (!confirm('Are you sure you want to cancel this slot?')) {
    return;
  }

  try {
    const res = await fetch('/api/availability/slot', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Lecturer-Id': lecturerId
      },
      body: JSON.stringify({
        dayOfWeek,
        slotId
      })
    });

    const data = await res.json();

    if (data.success) {
      showMessage('Slot cancelled successfully', 'success');
      loadAvailability();
    } else {
      showMessage(data.message || 'Error cancelling slot', 'error');
    }
  } catch (error) {
    console.error('Error cancelling slot:', error);
    showMessage('Error cancelling slot', 'error');
  }
}

function handleCopySlotClick(e) {
  e.stopPropagation();

  // If the dropdown is already open, close it
  const existingMenu = document.getElementById('floating-copy-dropdown');
  if (existingMenu) {
    removeFloatingDropdown();
    return;
  }

  const btn = e.currentTarget;
  const dayOfWeek = parseInt(btn.dataset.day);

  // Read slot data from button data attributes
  const course = btn.dataset.course;
  const venue = btn.dataset.venue;
  const maxStudents = btn.dataset.max;
  const sourceStart = btn.dataset.start;
  const sourceEnd = btn.dataset.end;

  // Get button position for dropdown placement
  const btnRect = btn.getBoundingClientRect();

  // Create the floating dropdown as a child of <body> to escape all stacking contexts
  const menu = document.createElement('div');
  menu.id = 'floating-copy-dropdown';
  menu.className = 'copy-dropdown-menu';

  menu.innerHTML = `
    <div class="copy-dropdown-header">Copy to...</div>
    <div class="copy-dropdown-sub">Course: ${course} | Venue: ${venue}</div>
    ${[1, 2, 3, 4, 5].filter(d => d !== dayOfWeek).map(d => `
      <div class="copy-day-option">
        <i class="bi bi-calendar-day"></i> ${dayLabels[d]}
        <span class="copy-day-time">
          <input type="time" class="copy-time-start" value="${sourceStart}">
          &nbsp;–&nbsp;
          <input type="time" class="copy-time-end" value="${sourceEnd}">
        </span>
        <button class="copy-apply-btn" data-target-day="${d}" data-course="${course}" data-venue="${venue}" data-max="${maxStudents}">Apply</button>
      </div>
    `).join('')}
    <div class="copy-dropdown-close-bar">
      <button class="copy-dropdown-close-btn">Close <i class="bi bi-x-lg"></i></button>
    </div>
  `;

  // Position fixed relative to viewport
  menu.style.position = 'fixed';
  menu.style.top = (btnRect.bottom + 6) + 'px';
  menu.style.left = Math.max(10, Math.min(btnRect.left - 80, window.innerWidth - 340)) + 'px';
  menu.style.zIndex = '999999';

  document.body.appendChild(menu);

  // Animate in after append
  requestAnimationFrame(() => {
    menu.style.opacity = '1';
  });

  // Reposition if off-screen
  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = 'auto';
      menu.style.bottom = (window.innerHeight - btnRect.top + 6) + 'px';
    }
  });

  // Event listeners
  menu.querySelectorAll('.copy-apply-btn').forEach(applyBtn => {
    applyBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const targetDay = parseInt(applyBtn.dataset.targetDay);
      const optionDiv = applyBtn.closest('.copy-day-option');
      const newStart = optionDiv.querySelector('.copy-time-start').value;
      const newEnd = optionDiv.querySelector('.copy-time-end').value;
      const slotCourse = applyBtn.dataset.course;
      const slotVenue = applyBtn.dataset.venue;
      const slotMax = applyBtn.dataset.max;

      fillSlotForm(targetDay, slotCourse, slotVenue, slotMax, newStart, newEnd);
      removeFloatingDropdown();
    });
  });

  const closeBtn = menu.querySelector('.copy-dropdown-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeFloatingDropdown();
    });
  }
}

// Close floating dropdown on any click outside it
document.addEventListener('click', (e) => {
  const menu = document.getElementById('floating-copy-dropdown');
  if (!menu) return;
  if (!e.target.closest('#floating-copy-dropdown') && !e.target.closest('.copy-slot-btn')) {
    removeFloatingDropdown();
  }
});

function fillSlotForm(dayOfWeek, course, venue, maxStudents, start, end) {
  const dayCard = document.querySelector(`.day-card[data-day="${dayOfWeek}"]`);
  if (!dayCard) return;

  // Check if the copied time would conflict with existing slots on the target day
  const existingSlots = getExistingSlotsForDay(dayOfWeek);
  const hasConflict = hasTimeConflict(existingSlots, start, end);

  // Scroll to the target day card
  dayCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Fill in the values
  const startInput = dayCard.querySelector('.slot-start');
  const endInput = dayCard.querySelector('.slot-end');
  const courseInput = dayCard.querySelector('.slot-course');
  const venueInput = dayCard.querySelector('.slot-venue');
  const maxInput = dayCard.querySelector('.slot-max-students');

  if (startInput) startInput.value = start || '';
  if (endInput) endInput.value = end || '';
  if (courseInput) courseInput.value = course;
  if (venueInput) venueInput.value = venue;
  if (maxInput) maxInput.value = maxStudents;

  // Highlight the day card briefly
  dayCard.classList.add('day-card-highlight');
  setTimeout(() => dayCard.classList.remove('day-card-highlight'), 1500);

  // Show a brief tooltip message in the day header
  const existingMsg = dayCard.querySelector('.copy-fill-msg');
  if (existingMsg) existingMsg.remove();
  const fillMsg = document.createElement('div');
  fillMsg.className = hasConflict ? 'copy-fill-msg conflict' : 'copy-fill-msg';
  fillMsg.textContent = hasConflict
    ? '⚠️ Time conflict! This time overlaps an existing slot. Adjust time before adding.'
    : '✓ Slot details copied! Adjust time and click "Add Slot"';
  dayCard.querySelector('.day-header').after(fillMsg);
  setTimeout(() => fillMsg.remove(), 5000);

  if (hasConflict) {
    showMessage(`⚠️ Time conflict on ${dayLabels[dayOfWeek]}! The copied time overlaps an existing slot. Please adjust the time.`, 'error');
  } else {
    showMessage(`Details copied to ${dayLabels[dayOfWeek]}! Adjust time and click Add Slot`, 'success');
  }
}

// Auto-fill last used values after successfully adding a slot
function autoFillLastUsed() {
  if (lastSlotValues.course || lastSlotValues.venue || lastSlotValues.maxStudents) {
    document.querySelectorAll('.day-card').forEach(card => {
      const courseInput = card.querySelector('.slot-course');
      const venueInput = card.querySelector('.slot-venue');
      const maxInput = card.querySelector('.slot-max-students');
      // Only auto-fill if the field is empty
      if (courseInput && !courseInput.value) courseInput.value = lastSlotValues.course;
      if (venueInput && !venueInput.value) venueInput.value = lastSlotValues.venue;
      if (maxInput && !maxInput.value) maxInput.value = lastSlotValues.maxStudents;
    });
  }
}

// ─── Edit Slot Modal ──────────────────────────────────────────────────────

let editingSlotData = null; // stores { dayOfWeek, slotId, start, end, course, venue, maxStudents }

// Global event delegation fallback for Edit buttons
document.addEventListener('click', function(e) {
  const editBtn = e.target.closest('.edit-slot-btn');
  if (!editBtn) return;
  if (editBtn.classList.contains('disabled') || editBtn.hasAttribute('disabled')) return;
  // Check if a direct listener already handled this (per-button listener calls stopPropagation)
  // If we get here, the per-button listener was not present, so handle via delegation
  handleEditSlot(editBtn);
});

function handleEditSlot(btn) {
  editingSlotData = {
    dayOfWeek: parseInt(btn.dataset.day),
    slotId: btn.dataset.slotId,
    start: btn.dataset.start,
    end: btn.dataset.end,
    course: btn.dataset.course,
    venue: btn.dataset.venue,
    maxStudents: btn.dataset.max
  };
  showEditModal();
}

function showEditModal() {
  const slotData = editingSlotData;

  // Remove any existing modal
  closeEditModal();
  editingSlotData = slotData;

  if (!editingSlotData) return;

  const overlay = document.createElement('div');
  overlay.className = 'edit-modal-overlay';
  overlay.id = 'edit-modal-overlay';

  overlay.innerHTML = `
    <div class="edit-modal">
      <div class="edit-modal-header">
        <h3><i class="bi bi-pencil"></i> Edit Slot</h3>
        <button class="edit-modal-close-btn" id="edit-modal-close-btn">&times;</button>
      </div>
      <div class="edit-modal-body">
        <div class="edit-modal-day">${dayLabels[editingSlotData.dayOfWeek]}</div>
        <label>Start Time</label>
        <input type="time" class="edit-input edit-start" value="${editingSlotData.start}">
        <label>End Time</label>
        <input type="time" class="edit-input edit-end" value="${editingSlotData.end}">
        <label>Course</label>
        <input type="text" class="edit-input edit-course" value="${editingSlotData.course}">
        <label>Venue</label>
        <input type="text" class="edit-input edit-venue" value="${editingSlotData.venue}">
        <label>Max Students</label>
        <input type="number" class="edit-input edit-max" value="${editingSlotData.maxStudents}" min="1">
      </div>
      <div class="edit-modal-footer">
        <button class="edit-modal-cancel-btn" id="edit-modal-cancel-btn">Cancel</button>
        <button class="edit-modal-save-btn" id="edit-modal-save-btn"><i class="bi bi-check-lg"></i> Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });

  // Event listeners
  document.getElementById('edit-modal-close-btn').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-cancel-btn').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-save-btn').addEventListener('click', saveEditSlot);

  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEditModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', handleEditModalEscape);
}

function handleEditModalEscape(e) {
  if (e.key === 'Escape') {
    closeEditModal();
  }
}

function closeEditModal() {
  const overlay = document.getElementById('edit-modal-overlay');
  if (overlay) overlay.remove();
  editingSlotData = null;
  document.removeEventListener('keydown', handleEditModalEscape);
}

async function saveEditSlot() {
  const overlay = document.getElementById('edit-modal-overlay');
  if (!overlay) return;

  const start = overlay.querySelector('.edit-start').value;
  const end = overlay.querySelector('.edit-end').value;
  const course = overlay.querySelector('.edit-course').value.trim();
  const venue = overlay.querySelector('.edit-venue').value.trim();
  const maxStudents = parseInt(overlay.querySelector('.edit-max').value);

  // Validation
  if (!start || !end || !course || !venue || !maxStudents) {
    showMessage('Please fill in all fields', 'error');
    return;
  }
  if (maxStudents < 1) {
    showMessage('Max students must be at least 1', 'error');
    return;
  }
  if (start >= end) {
    showMessage('Start time must be before end time', 'error');
    return;
  }

  // Calculate duration
  const duration = calculateDuration(start, end);
  if (duration < 15) {
    showMessage('Duration must be at least 15 minutes', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/availability/slot/${editingSlotData.slotId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Lecturer-Id': lecturerId,
        'X-Lecturer-Name': lecturerName
      },
      body: JSON.stringify({
        dayOfWeek: editingSlotData.dayOfWeek,
        start,
        end,
        duration,
        course,
        venue,
        maxStudents
      })
    });

    const data = await res.json();

    if (data.success) {
      showMessage('Slot updated successfully', 'success');
      closeEditModal();
      loadAvailability(); // Reload to reflect changes
    } else {
      showMessage(data.message || 'Error updating slot', 'error');
    }
  } catch (error) {
    console.error('Error updating slot:', error);
    showMessage('Error updating slot', 'error');
  }
}

function showMessage(text, type) {
  msg.className = `message ${type}`;
  msg.textContent = text;
  setTimeout(() => {
    msg.className = 'message';
  }, 3000);
}

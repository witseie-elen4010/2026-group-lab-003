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
      renderAllSlots(data.availability.weeklySchedule || []);
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
    
    slotItem.innerHTML = `
      <div class="slot-info">
        <div class="slot-time">${formatTime(slot.start)} - ${formatTime(slot.end)}</div>
        <div class="slot-details">Duration: <span>${slot.duration} min</span></div>
        <div class="slot-details">Course: <span>${slot.course}</span></div>
        <div class="slot-details">Max Students: <span>${slot.maxStudents}</span></div>
      </div>
      <button class="cancel-slot-btn" data-day="${dayOfWeek}" data-slot-id="${slot._id}">Cancel</button>
    `;
    
    slotsList.appendChild(slotItem);
  });

  // Add event listeners to cancel buttons
  slotsList.querySelectorAll('.cancel-slot-btn').forEach(btn => {
    btn.addEventListener('click', handleCancelSlot);
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

async function handleAddSlot(e) {
  const dayOfWeek = parseInt(e.target.dataset.day);
  const dayCard = e.target.closest('.day-card');
  
  const start = dayCard.querySelector('.slot-start').value;
  const end = dayCard.querySelector('.slot-end').value;
  const course = dayCard.querySelector('.slot-course').value.trim();
  const maxStudents = parseInt(dayCard.querySelector('.slot-max-students').value);

  // Validation
  if (!start || !end || !course || !maxStudents) {
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
        maxStudents
      })
    });

    const data = await res.json();
    
    if (data.success) {
      showMessage('Slot added successfully', 'success');
      // Clear the form
      dayCard.querySelector('.slot-start').value = '';
      dayCard.querySelector('.slot-end').value = '';
      dayCard.querySelector('.slot-course').value = '';
      dayCard.querySelector('.slot-max-students').value = '';
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

function showMessage(text, type) {
  msg.className = `message ${type}`;
  msg.textContent = text;
  setTimeout(() => {
    msg.className = 'message';
  }, 3000);
}
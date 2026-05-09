// Fixed: Slots load on page open
const lecturerEmail = localStorage.getItem('lecturerEmail') || 'test@lecturer.com';
const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
let slotCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Availability loaded for:', lecturerEmail);
  
  // ALWAYS add first slot
  addSlot();
  
  // Then setup events + load
  document.getElementById('addSlotBtn').onclick = addSlot;
  document.getElementById('resetBtn').onclick = resetForm;
  document.getElementById('availabilityForm').onsubmit = saveAvailability;
  
  //Attach live preview updates for workload inputs
  document.getElementById('slotCapacity').onchange = updatePreview;
  document.getElementById('dailySessionLimit').onchange = updatePreview;

  // Load AFTER initial slot
  loadAvailability();
});

function addSlot(slotData = null) {
  const container = document.getElementById('slotsContainer');
  const slotDiv = document.createElement('div');
  slotDiv.className = 'slot-row';
  slotDiv.dataset.slotId = slotCounter;
  
  slotDiv.innerHTML = `
    <div class="row g-3 align-items-end">
      <div class="col-lg-3 col-md-12">
        <label>Days</label>
        <div class="day-selector">
          ${daysOfWeek.map((day, index) => `
            <div class="form-check form-check-inline">
              <input class="form-check-input day-check" type="checkbox" id="day-${slotCounter}-${day}" value="${day}" ${slotData && slotData.days?.includes(day) ? 'checked' : ''}>
              <label class="form-check-label" for="day-${slotCounter}-${day}">${day.toUpperCase()}</label>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="col-lg-3 col-md-5">
        <label>Start</label>
        <input type="time" class="form-control time-input start-time" value="${slotData?.start || ''}" min="08:00" max="18:00">
      </div>
      <div class="col-lg-3 col-md-5">
        <label>End</label>
        <input type="time" class="form-control time-input end-time" value="${slotData?.end || ''}" min="08:00" max="22:00">
      </div>
      <div class="col-lg-3 col-md-2">
        <button type="button" class="btn btn-danger-custom w-100 remove-slot">× Delete</button>
      </div>
    </div>
  `;
  
  container.appendChild(slotDiv);
  
  // Events
  slotDiv.querySelector('.remove-slot').onclick = () => {
    slotDiv.style.opacity = '0';
    slotDiv.style.transform = 'translateX(-20px)';
    setTimeout(() => slotDiv.remove(), 250);
  };
  
  // Live preview
  slotDiv.querySelectorAll('input').forEach(input => {
    input.onchange = updatePreview;
  });
  
  slotCounter++;
  updatePreview();
}

async function saveAvailability(e) {
  e.preventDefault();
  console.log('💾 Saving...');
  
  const transformedSchedule = [];
  
  // Collect + transform slots
  document.querySelectorAll('.slot-row').forEach(slotRow => {
    const checkedDays = Array.from(slotRow.querySelectorAll('.day-check:checked')).map(cb => cb.value);
    const start = slotRow.querySelector('.start-time').value;
    const end = slotRow.querySelector('.end-time').value;
    
    if (checkedDays.length && start && end && start < end) {
      checkedDays.forEach(day => {
        const dayNum = daysOfWeek.indexOf(day);
        if (dayNum >= 0) {
          transformedSchedule.push({
            dayOfWeek: dayNum,
            slots: [{ start, end }]
          });
        }
      });
    }
  });

  const slotCapacity = parseInt(document.getElementById('slotCapacity').value) || 1;
  const dailySessionLimit = parseInt(document.getElementById('dailySessionLimit').value) || 10;
  
  
  const data = {
    defaultDuration: parseInt(document.getElementById('defaultDuration').value) || 30,
    slotCapacity: slotCapacity,
    dailySessionLimit: dailySessionLimit,
    weeklySchedule: transformedSchedule
  };
  
  try {
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lecturer-Email': lecturerEmail
      },
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      const result = await res.json();
      console.log('✅ Saved:', result);
      document.querySelector('.btn-primary-custom').innerHTML = '<i class="bi bi-check-circle-fill"></i> Saved!';
      setTimeout(() => {
        document.querySelector('.btn-primary-custom').innerHTML = '<i class="bi bi-save2-fill"></i> Save Changes';
      }, 2000);
    } else {
      console.error('❌ Save failed:', res.status);
    }
  } catch (err) {
    console.error('❌ Save error:', err);
  }
}

async function loadAvailability() {
  try {
    const res = await fetch('/api/availability', {
      headers: { 'X-Lecturer-Email': lecturerEmail }
    });
    const data = await res.json();
    console.log('📥 Loaded:', data);
    
    document.getElementById('defaultDuration').value = data.defaultDuration || 30;
    
    // Clear initial slot, load real data
    document.getElementById('slotsContainer').innerHTML = '';
    slotCounter = 0;
    
    if (data.weeklySchedule?.length) {
      // Group by day + recreate slots
      const daySlots = {};
      data.weeklySchedule.forEach(item => {
        const dayName = daysOfWeek[item.dayOfWeek];
        if (dayName) {
          item.slots.forEach(slot => {
            if (!daySlots[dayName]) daySlots[dayName] = [];
            daySlots[dayName].push({ days: [dayName], start: slot.start, end: slot.end });
          });
        }
      });
      
      Object.values(daySlots).forEach(slots => {
        slots.forEach(slot => addSlot(slot));
      });
    }
    
    if (!document.querySelector('.slot-row')) addSlot(); // Ensure at least 1
        updatePreview();
  } catch (err) {
    console.log('No saved data, using empty form');
        updatePreview();

  }
}

function resetForm() {
  if (confirm('Reset all slots to default?')) {
    document.getElementById('slotsContainer').innerHTML = '';
    document.getElementById('defaultDuration').value = 30;
    document.getElementById('slotCapacity').value = 1;
    document.getElementById('dailySessionLimit').value = 10;
    slotCounter = 0;
    addSlot();
  }
}

function updatePreview() {
  const slots = [];
  document.querySelectorAll('.slot-row').forEach(slotRow => {
    const days = Array.from(slotRow.querySelectorAll('.day-check:checked')).map(cb => cb.value);
    const start = slotRow.querySelector('.start-time').value;
    const end = slotRow.querySelector('.end-time').value;
    if (days.length && start && end) {
      slots.push({ days: days.join(', '), time: `${start}-${end}` });
    }
  });
  
  const capacity = document.getElementById('slotCapacity').value || 1;
  const dailyLimit = document.getElementById('dailySessionLimit').value || 10;

  let previewHTML = '';
  if (slots.length) {
    previewHTML += `✅ ${slots.length} time slot(s) defined<br>`;
    slots.forEach(s => {
      previewHTML += `• ${s.days}: ${s.time}<br>`;
    });
  } else {
    previewHTML = 'No slots selected yet...<br>';
  }
  
  previewHTML += `<br>📊 Workload Limits:<br>`;
  previewHTML += `• Max students per slot: ${capacity}<br>`;
  previewHTML += `• Max daily bookings: ${dailyLimit}<br>`;
  

  document.getElementById('preview').innerHTML = previewHTML;
}
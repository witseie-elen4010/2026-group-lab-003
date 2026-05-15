document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DOM ELEMENTS
  // ==========================================
  const moduleSelect = document.getElementById('module')
  const lecturerSelect = document.getElementById('lecturerId')
  const dateInput = document.getElementById('bookingDate')
  const slotsContainer = document.getElementById('time-slots-container')

  const selectedStartInput = document.getElementById('selectedStartTime')
  const selectedEndInput = document.getElementById('selectedEndTime')
  const newBookingForm = document.getElementById('newBookingForm')

  // Set minimum date to today to prevent past bookings
  const today = new Date().toISOString().split('T')[0]
  if (dateInput) dateInput.min = today

  // ==========================================
  // 2. EVENT LISTENERS (Lecturer & Date)
  // ==========================================
  if (lecturerSelect) lecturerSelect.addEventListener('change', checkAndGenerateSlots)
  if (dateInput) dateInput.addEventListener('change', checkAndGenerateSlots)

  // ==========================================
  // 3. CORE FETCH LOGIC (Talking to Backend)
  // ==========================================
  
  // Store the fetched data globally for the dropdowns
  let availabilityData = []

  // --- A. INITIALIZE DROPDOWNS ---
  async function loadFormData () {
    try {
      const response = await fetch('/api/bookings/form-data')
      availabilityData = await response.json()

      const uniqueCourses = new Set()
      
      // Look for courses in the main array AND inside the weekly slots
      availabilityData.forEach(lecturer => {
        // 1. Check main courses array
        if (lecturer.courses && Array.isArray(lecturer.courses)) {
          lecturer.courses.forEach(course => uniqueCourses.add(course))
        }
        
        // 2. Check inside the actual scheduled slots
        if (lecturer.weeklySchedule && Array.isArray(lecturer.weeklySchedule)) {
          lecturer.weeklySchedule.forEach(day => {
            if (day.slots && Array.isArray(day.slots)) {
              day.slots.forEach(slot => {
                if (slot.course) uniqueCourses.add(slot.course)
              })
            }
          })
        }
      })

      moduleSelect.innerHTML = '<option value="" selected disabled>Select a module...</option>'
      
      if (uniqueCourses.size === 0) {
        moduleSelect.innerHTML = '<option value="" selected disabled>No modules available</option>'
        return
      }

      uniqueCourses.forEach(course => {
        const option = document.createElement('option')
        option.value = course
        option.textContent = course
        moduleSelect.appendChild(option)
      })
    } catch (error) {
      console.error('Error loading form data:', error)
      moduleSelect.innerHTML = '<option value="" selected disabled>Error loading modules</option>'
    }
  }

  // Run immediately on page load
  loadFormData()

  // --- B. MODULE DROPDOWN EVENT LISTENER ---
  if (moduleSelect) {
    moduleSelect.addEventListener('change', () => {
      const selectedCourse = moduleSelect.value

      lecturerSelect.innerHTML = '<option value="" selected disabled>Select a lecturer...</option>'

      const matchingLecturers = availabilityData.filter(lecturer => {
        // Does the lecturer have this course in their root array?
        const inRoot = lecturer.courses && lecturer.courses.includes(selectedCourse)
        
        // Does the lecturer have this course in any of their slots?
        const inSlots = lecturer.weeklySchedule && lecturer.weeklySchedule.some(day => 
          day.slots && day.slots.some(slot => slot.course === selectedCourse)
        )
        
        return inRoot || inSlots
      })

      matchingLecturers.forEach(lecturer => {
        const option = document.createElement('option')
        option.value = lecturer.lecturerEmail
        option.textContent = lecturer.lecturerEmail 
        lecturerSelect.appendChild(option)
      })

      lecturerSelect.disabled = false

      if (dateInput && dateInput.value) {
        checkAndGenerateSlots()
      }
    })
  }

  // --- C. FETCH SLOTS FUNCTION ---
  async function checkAndGenerateSlots () {
    const lecturerId = lecturerSelect.value
    const date = dateInput.value
    const selectedModule = moduleSelect.value

    if (lecturerId && date && selectedModule) {
      slotsContainer.innerHTML = '<div class="text-muted small">Loading available slots...</div>'

      try {
        const response = await fetch(`/api/bookings/availability?lecturerId=${lecturerId}&date=${date}`)
        const data = await response.json()

        if (data.error || !data.availableBlocks || data.availableBlocks.length === 0) {
          slotsContainer.innerHTML = `<div class="text-danger small">${data.message || 'No availability on this date.'}</div>`
          selectedStartInput.value = ''
          selectedEndInput.value = ''
          return
        }

        const availableSlots = data.availableBlocks.filter(slot => {
          const isCorrectModule = slot.course === selectedModule
          const currentBookingsCount = data.bookedTimes.filter(time => time === slot.start).length
          const hasSpace = currentBookingsCount < slot.maxStudents
          return isCorrectModule && hasSpace
        })

        renderSlotsToUI(availableSlots)
      } catch (error) {
        console.error('Error fetching slots:', error)
        slotsContainer.innerHTML = '<div class="text-danger small">Error loading slots. Please try again later.</div>'
      }
    }
  }

  // ==========================================
  // 4. RENDER UTILITIES
  // ==========================================
  function renderSlotsToUI(slotsArray) {
    slotsContainer.innerHTML = '';
    selectedStartInput.value = '';
    selectedEndInput.value = '';

    if (slotsArray.length === 0) {
      slotsContainer.innerHTML = '<div class="text-danger small">No available slots for this module on this date.</div>';
      return;
    }

    slotsArray.forEach(slot => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline-primary m-1 slot-btn';

      // Safe check for duration
      const durationText = slot.duration ? `<br><small class="text-muted">${slot.duration} min</small>` : '';
      btn.innerHTML = `${slot.start} - ${slot.end} ${durationText}`;

      btn.onclick = () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        selectedStartInput.value = slot.start;
        selectedEndInput.value = slot.end;
      };

      slotsContainer.appendChild(btn);
    });
  }

  // ==========================================
  // 5. FORM SUBMISSION
  // ==========================================
  if (newBookingForm) {
    newBookingForm.addEventListener('submit', async (e) => {
      e.preventDefault()

      if (!selectedStartInput.value) {
        alert('Please select a time slot!')
        return
      }

      const user = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user'))

      if (!user || !user.email) {
        alert('You must be logged in to book a session.')
        window.location.href = '../login-page.html'
        return
      }

      const bookingData = {
        studentId: user.email,
        module: moduleSelect.value,
        lecturerId: lecturerSelect.value,
        date: dateInput.value,
        startTime: selectedStartInput.value,
        endTime: selectedEndInput.value,
        topic: document.getElementById('topic') ? document.getElementById('topic').value : ''
      }

      const submitBtn = document.querySelector('.book_button')
      submitBtn.disabled = true
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...'

      try {
        const response = await fetch('/api/bookings', { // NOTE: Change to '/api/bookings/create' if using the custom route from earlier
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        })

        if (response.ok) {
          alert('Booking successful!')
          window.location.href = 'student-dashboard.html'
        } else {
          const errorData = await response.json()
          alert(`Booking failed: ${errorData.error || errorData.message}`)
        }
      } catch (error) {
        console.error('Booking submission error:', error)
        alert('Network error. Please try again.')
      } finally {
        submitBtn.disabled = false
        submitBtn.innerHTML = '<i class="fas fa-calendar-check me-2"></i> Confirm Booking'
      }
    })
  }

});
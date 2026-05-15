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
  // 2. EVENT LISTENERS
  // ==========================================
  if (moduleSelect) {
    moduleSelect.addEventListener('change', () => {
      lecturerSelect.disabled = false
      checkAndGenerateSlots()
    })
  }

  if (lecturerSelect) lecturerSelect.addEventListener('change', checkAndGenerateSlots)
  if (dateInput) dateInput.addEventListener('change', checkAndGenerateSlots)

  // ==========================================
  // 3. CORE FETCH LOGIC (Talking to Backend)
  // ==========================================
  async function checkAndGenerateSlots () {
    const lecturerId = lecturerSelect.value
    const date = dateInput.value

    if (lecturerId && date) {
      slotsContainer.innerHTML = '<div class="text-muted small">Loading available slots...</div>'

      try {
        // Fetch data from your backend API
        const response = await fetch(`/api/bookings/availability?lecturerId=${lecturerId}&date=${date}`)
        const data = await response.json()

        // Handle errors or no availability
        if (data.error || !data.availableBlocks || data.availableBlocks.length === 0) {
          slotsContainer.innerHTML = `<div class="text-danger small">${data.message || 'No availability on this date.'}</div>`
          selectedStartInput.value = ''
          selectedEndInput.value = ''
          return
        }

        const allPossibleSlots = []

        // Generate slots for each block the lecturer is available (e.g., Morning Block, Afternoon Block)
        data.availableBlocks.forEach(block => {
          const slotsForBlock = generateTimeSlots(block.start, block.end, data.duration)
          allPossibleSlots.push(...slotsForBlock)
        })

        // Filter out slots that are already booked
        const availableSlots = allPossibleSlots.filter(slot => {
          return !data.bookedTimes.includes(slot.start)
        })

        renderSlotsToUI(availableSlots)
      } catch (error) {
        console.error('Error fetching slots:', error)
        slotsContainer.innerHTML = '<div class="text-danger small">Error loading slots. Please try again later.</div>'
      }
    }
  }

  // ==========================================
  // 4. FORM SUBMISSION
  // ==========================================
  if (newBookingForm) {
    newBookingForm.addEventListener('submit', async (e) => {
      e.preventDefault()

      // Final validation: Did they actually click a time slot?
      if (!selectedStartInput.value) {
        alert('Please select a time slot!')
        return
      }

      // Gather the data to send to your backend
      const user = JSON.parse(sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user'))

      // ADD THIS CONSOLE LOG TO DEBUG
      console.log('Here is what the browser found:', user)

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
        participantIDs: [user.email],
        topic: document.getElementById('topic') ? document.getElementById('topic').value : ''
      }

      const submitBtn = document.querySelector('.book_button')
      submitBtn.disabled = true
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...'

      try {
        // Send POST request to backend
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingData)
        })

        if (response.ok) {
          alert('Booking successful!')
          window.location.href = 'student-dashboard.html' // Redirect back to dashboard
        } else {
          const errorData = await response.json()
          alert(`Booking failed: ${errorData.error}`)
        }
      } catch (error) {
        console.error('Booking submission error:', error)
        alert('Network error. Please try again.')
      } finally {
        // Reset button if there was an error
        submitBtn.disabled = false
        submitBtn.innerHTML = '<i class="fas fa-calendar-check me-2"></i> Confirm Booking'
      }
    })
  }

  // ==========================================
  // 5. UTILITY FUNCTIONS
  // ==========================================

  // Utility function to convert HH:MM to total minutes
  function timeToMinutes (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Utility function to convert total minutes back to HH:MM
  function minutesToTime (totalMinutes) {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
    const minutes = (totalMinutes % 60).toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Generate an array of time slots
  function generateTimeSlots (startTime, endTime, durationMins) {
    const startMins = timeToMinutes(startTime)
    const endMins = timeToMinutes(endTime)
    const slots = []

    for (let currentMins = startMins; currentMins + durationMins <= endMins; currentMins += durationMins) {
      slots.push({
        start: minutesToTime(currentMins),
        end: minutesToTime(currentMins + durationMins)
      })
    }
    return slots
  }

  // Render the slots to the HTML UI
  function renderSlotsToUI (slotsArray) {
    slotsContainer.innerHTML = '' // Clear old slots
    selectedStartInput.value = '' // Reset hidden inputs
    selectedEndInput.value = ''

    if (slotsArray.length === 0) {
      slotsContainer.innerHTML = '<div class="text-danger small">No available slots for this day.</div>'
      return
    }

    slotsArray.forEach(slot => {
      const btn = document.createElement('button')
      btn.type = 'button' // Prevents form submission when clicking a slot
      btn.className = 'btn btn-outline-primary m-1 slot-btn'
      btn.innerText = `${slot.start} - ${slot.end}`

      // When clicked, save the selected times to hidden inputs
      btn.onclick = () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')

        selectedStartInput.value = slot.start
        selectedEndInput.value = slot.end
      }

      slotsContainer.appendChild(btn)
    })
  }
})

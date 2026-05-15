// 1. GLOBAL STATE
const currentDate = new Date()
let sessions = []

// 2. THE CORE FUNCTION
function renderCalendar (date, bookings = []) {
  const monthDisplay = document.getElementById('month-display')
  const daysGrid = document.getElementById('days-grid')
  if (!daysGrid) return

  daysGrid.innerHTML = '' // Clears "Loading..."

  const year = date.getFullYear()
  const month = date.getMonth()

  if (monthDisplay) {
    monthDisplay.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Add empty padding
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div')
    emptyDiv.classList.add('day-cell', 'empty')
    daysGrid.appendChild(emptyDiv)
  }

  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div')
    dayCell.classList.add('day-cell')
    dayCell.textContent = day

    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // FILTER LOGIC
    const dayBookings = bookings.filter(b => {
      if (!b || !b.date || b.status === 'canceled') return false
      const bDate = b.date.split('T')[0]
      return bDate === dateString
    }) // Make sure this closing }); is here!

    if (dayBookings.length > 0) {
      dayCell.classList.add('has-booking')
      const dot = document.createElement('div')
      dot.classList.add('booking-indicator')
      dayCell.appendChild(dot)
      dayCell.title = `${dayBookings.length} session(s) scheduled`
    }

    const today = new Date()
    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      dayCell.classList.add('today')
    }

    daysGrid.appendChild(dayCell)
  }
}

// 3. API FETCH LOGIC
async function loadUserBookings () {
  const userData = sessionStorage.getItem('sychro_current_user')
  if (!userData) {
    renderCalendar(currentDate, [])
    return
  }

  const user = JSON.parse(userData)
  // Matches your partner's backend routes
  const endpoint = user.role === 'lecturer'
    ? `/api/bookings/lecturer/bookings?email=${encodeURIComponent(user.email)}`
    : `/api/bookings?studentId=${encodeURIComponent(user.email)}`

  try {
    const response = await fetch(endpoint)
    if (response.ok) {
      sessions = await response.json()
    }
    renderCalendar(currentDate, sessions)
  } catch (error) {
    console.error('Fetch failed:', error)
    renderCalendar(currentDate, [])
  }
}

// 4. BROWSER INITIALIZATION
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const prevBtn = document.getElementById('prev-month')
    const nextBtn = document.getElementById('next-month')

    prevBtn?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1)
      renderCalendar(currentDate, sessions)
    })

    nextBtn?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1)
      renderCalendar(currentDate, sessions)
    })

    loadUserBookings()
  })
}

// 5. EXPORT FOR JEST
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCalendar }
}

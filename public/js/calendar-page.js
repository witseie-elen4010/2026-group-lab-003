// 1. GLOBAL STATE (Top level)
const currentDate = new Date()

// 2. THE CORE FUNCTION (Top level - visible to Jest)
function renderCalendar (testDate = null) {
  const dateToRender = testDate || currentDate

  const monthDisplay = document.getElementById('month-display')
  const daysGrid = document.getElementById('days-grid')

  if (!daysGrid || !monthDisplay) return // Important for tests

  daysGrid.innerHTML = ''
  const year = dateToRender.getFullYear()
  const month = dateToRender.getMonth()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  monthDisplay.textContent = `${monthNames[month]} ${year}`

  const firstDayIndex = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const isCurrentMonthYear = today.getMonth() === month && today.getFullYear() === year

  // Create empty padding cells
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div')
    emptyCell.classList.add('day-cell', 'empty')
    daysGrid.appendChild(emptyCell)
  }

  // Create actual day cells
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div')
    dayCell.classList.add('day-cell')
    dayCell.textContent = day
    if (isCurrentMonthYear && day === today.getDate()) {
      dayCell.classList.add('today')
    }
    daysGrid.appendChild(dayCell)
  }
}

// 3. BROWSER INITIALIZATION
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const prevBtn = document.getElementById('prev-month')
    const nextBtn = document.getElementById('next-month')

    prevBtn?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1)
      renderCalendar()
    })

    nextBtn?.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1)
      renderCalendar()
    })

    renderCalendar()
  })
}

// 4. EXPORT FOR JEST (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderCalendar }
}

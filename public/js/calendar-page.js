document.addEventListener('DOMContentLoaded', () => {
  const monthDisplay = document.getElementById('month-display')
  const daysGrid = document.getElementById('days-grid')
  const prevBtn = document.getElementById('prev-month')
  const nextBtn = document.getElementById('next-month')

  // Start with the current date
  const currentDate = new Date()

  function renderCalendar () {
    // Clear previous month's cells
    daysGrid.innerHTML = ''

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 1. Display the formatted month and year (e.g., "May 2026")
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    monthDisplay.textContent = `${monthNames[month]} ${year}`

    // 2. Get the day of the week the month starts on (0 = Sun, 1 = Mon, etc.)
    const firstDayIndex = new Date(year, month, 1).getDay()

    // 3. Get the total number of days in the current month
    // (Passing 0 as the day gets the last day of the previous month, effectively giving us the total days of the target month)
    const totalDays = new Date(year, month + 1, 0).getDate()

    // Helper to check if a specific cell is "Today"
    const today = new Date()
    const isCurrentMonthYear = today.getMonth() === month && today.getFullYear() === year

    // Step A: Create empty padding cells for the days before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div')
      emptyCell.classList.add('day-cell', 'empty')
      daysGrid.appendChild(emptyCell)
    }

    // Step B: Create the actual day cells (1 through totalDays)
    for (let day = 1; day <= totalDays; day++) {
      const dayCell = document.createElement('div')
      dayCell.classList.add('day-cell')
      dayCell.textContent = day

      // Highlight if it's the current day
      if (isCurrentMonthYear && day === today.getDate()) {
        dayCell.classList.add('today')
      }

      // Optional: Add click listener for when a student selects a date
      dayCell.addEventListener('click', () => {
        // Format date as YYYY-MM-DD for your backend
        const formattedMonth = String(month + 1).padStart(2, '0')
        const formattedDay = String(day).padStart(2, '0')
        const selectedDateStr = `${year}-${formattedMonth}-${formattedDay}`

        console.log('Selected Date:', selectedDateStr)
      })

      daysGrid.appendChild(dayCell)
    }
  }

  // Event Listeners for navigation buttons
  prevBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1)
    renderCalendar()
  })

  nextBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1)
    renderCalendar()
  })

  // Initial load
  renderCalendar()
})

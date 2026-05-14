/**
 * @jest-environment jsdom
 */

const { renderCalendar } = require('../../public/js/calendar-page')

describe('Calendar Logic Tests', () => {
  let monthDisplay, daysGrid

  beforeEach(() => {
    // Refresh the mock DOM before every test
    document.body.innerHTML = `
      <h2 id="month-display"></h2>
      <div id="days-grid"></div>
    `
    monthDisplay = document.getElementById('month-display')
    daysGrid = document.getElementById('days-grid')
  })

  // --- EXISTING TESTS ---

  test('should display May 2026 for the given test date', () => {
    const testDate = new Date(2026, 4, 13) // May 13, 2026
    renderCalendar(testDate)
    expect(monthDisplay.textContent).toBe('May 2026')
  })

  test('should generate 36 cells total for May 2026 (5 padding + 31 days)', () => {
    const testDate = new Date(2026, 4, 1)
    renderCalendar(testDate)
    const allCells = daysGrid.querySelectorAll('.day-cell')
    expect(allCells.length).toBe(36)
  })

  test('should correctly identify "Today" cell', () => {
    const today = new Date()
    renderCalendar(today)
    const todayCell = daysGrid.querySelector('.today')

    expect(todayCell).not.toBeNull()
    expect(todayCell.textContent).toBe(today.getDate().toString())
  })

  test('should have 4 empty padding cells for January 2026', () => {
    const testDate = new Date(2026, 0, 1)
    renderCalendar(testDate)
    const emptyCells = daysGrid.querySelectorAll('.day-cell.empty')
    expect(emptyCells.length).toBe(4)
  })

  // --- NEW BOOKING INDICATOR TESTS ---

  test('should add a dot indicator if an upcoming booking exists on a specific day', () => {
    const testDate = new Date(2026, 4, 1) // May 2026
    const mockBookings = [
      { date: '2026-05-15T10:00:00Z', status: 'upcoming' }
    ]

    renderCalendar(testDate, mockBookings)

    const allCells = daysGrid.querySelectorAll('.day-cell:not(.empty)')
    const day15 = allCells[14] // Index 14 is the 15th

    expect(day15.classList.contains('has-booking')).toBe(true)
    expect(day15.querySelector('.booking-indicator')).not.toBeNull()
  })

  test('should NOT show a dot indicator if the booking status is "canceled"', () => {
    const testDate = new Date(2026, 4, 1)
    const mockBookings = [
      { date: '2026-05-15T10:00:00Z', status: 'canceled' }
    ]

    renderCalendar(testDate, mockBookings)

    const allCells = daysGrid.querySelectorAll('.day-cell:not(.empty)')
    const day15 = allCells[14]

    expect(day15.classList.contains('has-booking')).toBe(false)
    expect(day15.querySelector('.booking-indicator')).toBeNull()
  })

  test('should set the title attribute to the correct count of bookings', () => {
    const testDate = new Date(2026, 4, 1)
    const mockBookings = [
      { date: '2026-05-10T09:00:00Z', status: 'upcoming' },
      { date: '2026-05-10T14:00:00Z', status: 'upcoming' }
    ]

    renderCalendar(testDate, mockBookings)

    const allCells = daysGrid.querySelectorAll('.day-cell:not(.empty)')
    const day10 = allCells[9]

    expect(day10.title).toBe('2 session(s) scheduled')
  })
})

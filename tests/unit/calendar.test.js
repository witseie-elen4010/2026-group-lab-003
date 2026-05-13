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
    // Jan 1st, 2026 is a Thursday (Sun=0, Mon=1, Tue=2, Wed=3, Thu=4)
    const testDate = new Date(2026, 0, 1)
    renderCalendar(testDate)
    const emptyCells = daysGrid.querySelectorAll('.day-cell.empty')
    expect(emptyCells.length).toBe(4)
  })
})

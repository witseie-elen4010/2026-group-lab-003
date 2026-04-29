// UI LOGIC: Password Toggle (Runs immediately)
const togglePassword = document.querySelector('#togglePassword')
const passwordField = document.querySelector('#password')

togglePassword.addEventListener('click', function () {
  const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password'
  passwordField.setAttribute('type', type)
  this.textContent = type === 'password' ? 'visibility' : 'visibility_off'
})

// Text Entry password and email Logic
const emailInput = document.getElementById('email')
const emailError = document.getElementById('emailError')
const passwordInput = document.getElementById('password')
const passwordError = document.getElementById('passwordError')

// Listen for when the user leaves the field ('blur')
emailInput.addEventListener('blur', () => {
  // .trim() removes accidental spaces. So "   " still counts as empty.
  if (emailInput.value.trim() === '') {
    emailError.textContent = 'Please enter your email address.'
  }
})
passwordInput.addEventListener('blur', () => {
  if (passwordInput.value.trim() === '') {
    passwordError.textContent = 'Please enter your password.'
  }
})

// Listen for when the user starts typing ('input')
emailInput.addEventListener('input', () => {
  // As soon as they type a single character, clear the error message
  emailError.textContent = ''
})

passwordInput.addEventListener('input', () => {
  passwordError.textContent = ''
})

// FORM LOGIC: Submit & Fetch (Runs on click)
document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault() // Stop page from refreshing

  // Grab the actual text VALUES right when they hit submit
  const email = document.getElementById('email').value
  const emailError = document.getElementById('emailError')
  const passwordValue = document.getElementById('password').value
  const passwordError = document.getElementById('passwordError')
  const messageElement = document.getElementById('message')

  // Grab the text the user typed
  const emailValue = emailInput.value.trim()
  const password = passwordInput.value.trim()

  // Clear any old errors from previous attempts
  emailError.textContent = ''
  passwordError.textContent = ''

  // We assume the form is valid until proven otherwise!
  let isValid = true

  // Check the Email for empty and correct email address format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailValue === '') {
    emailError.textContent = 'Please enter your email address.'
    isValid = false // Mark the form as invalid
  } else if (!emailRegex.test(emailValue)) {
    emailError.textContent = 'Please enter a valid email (e.g., name@example.com).'
    isValid = false // Mark the form as invalid
  }

  // Check the Password
  if (password === '') {
    passwordError.textContent = 'Please enter your password.'
    isValid = false // Mark the form as invalid
  }

  // The Final Decision: If anything was wrong, stop everything right here.
  if (!isValid) {
    return
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send email and the passwordValue we just grabbed
      body: JSON.stringify({ email, passwordValue })
    })

    const data = await response.json()
    const rememberMe = document.getElementById('remember').checked

    if (data.success) {
      // If they checked "Remember Me", use localStorage (persists after closing browser)
      // If NOT, you could use sessionStorage (clears when tab closes)
      if (rememberMe) {
        localStorage.setItem('userEmail', email) // To pre-fill the box next time
        localStorage.setItem('isLoggedIn', 'true')
      }

      // Store user info in the browser so the app "remembers" them
      localStorage.setItem('userName', data.user.name)
      localStorage.setItem('userRole', data.user.role)

      alert('Login Successful!')

      // Redirect based on role (Requirement for Epic #2)
      if (data.user.role === 'lecturer') {
        window.location.href = '/lecturer-dashboard.html'
      } else {
        window.location.href = '/student-dashboard.html'
      }
    } else {
      alert('Login failed: ' + data.message)
    }
  } catch (error) {
    console.error('Error during login:', error)
    alert('An error occurred. Please try again.')
  }
})

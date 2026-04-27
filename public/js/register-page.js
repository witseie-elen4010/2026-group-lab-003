const togglePassword1 = document.querySelector('#togglePassword1')
const passwordField1 = document.querySelector('#password')

togglePassword1.addEventListener('click', function () {
  const type = passwordField1.getAttribute('type') === 'password' ? 'text' : 'password'
  passwordField1.setAttribute('type', type)
  this.textContent = type === 'password' ? 'visibility' : 'visibility_off'
})

const togglePassword2 = document.querySelector('#togglePassword2')
const passwordField2 = document.querySelector('#confirmPassword')

togglePassword2.addEventListener('click', function () {
  const type = passwordField2.getAttribute('type') === 'password' ? 'text' : 'password'
  passwordField2.setAttribute('type', type)
  this.textContent = type === 'password' ? 'visibility' : 'visibility_off'
})

const registerform = document.querySelector('#registrationForm')

registerform.addEventListener('submit', (e) => {
  e.preventDefault()

  // Grab the segment element
  const roleSegment = document.querySelector('#role')

  // Get the currently selected value ('student' or 'lecturer')
  const selectedRole = roleSegment.value

  console.log('Registering as:', selectedRole)
})

const emailInput = document.getElementById('email')
const emailError = document.getElementById('emailError')
const nameInput = document.getElementById('name')
const nameError = document.getElementById('nameError')
const surnameInput = document.getElementById('surname')
const surnameError = document.getElementById('surnameError')

const registrationForm = document.getElementById('registrationForm')
const passwordInput = document.getElementById('password')
const confirmInput = document.getElementById('confirmPassword')
const errorMessage = document.getElementById('error-message')
const passwordError = document.getElementById('passwordError')

const studentNoInput = document.getElementById('idNumber')
const studentNoError = document.getElementById('studnoError')

registrationForm.addEventListener('submit', async (event) => {
  const emailValue = emailInput.value.trim()
  const nameValue = nameInput.value.trim()
  const surnameValue = surnameInput.value.trim()
  const passwordValue = passwordInput.value.trim()
  const studentNoValue = studentNoInput.value.trim()

  // Clear any old errors from previous attempts
  emailError.textContent = ''
  nameError.textContent = ''
  surnameError.textContent = ''
  passwordError.textContent = ''
  studentNoError.textContent = ''

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

  // Check the name for empty
  if (nameValue === '') {
    nameError.textContent = 'Please enter your name.'
    isValid = false
  }

  if (surnameValue === '') {
    surnameError.textContent = 'Please enter your surname.'
    isValid = false
  }

  if (studentNoValue === '') {
    studentNoError.textContent = 'Please enter your student number.'
  }

  // Prevent the page from refreshing
  event.preventDefault()

  // Pull values from HTML
  const formData = {
    name: document.getElementById('name').value,
    surname: document.getElementById('surname').value,
    idNumber: document.getElementById('idNumber').value,
    email: document.getElementById('email').value,
    role: document.getElementById('role').value, // 'student' or 'lecturer'
    password: document.getElementById('password').value
  }

  const response = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  })

  const result = await response.json()
  if (result.success) {
    alert('Welcome to Synchro!')
    window.location.href = '/login-page.html'
  } else {
    alert('Error: ' + result.error)
  }

  // Clear any previous errors
  errorMessage.style.display = 'none'
  errorMessage.textContent = ''

  // Compare the values
  if (passwordInput.value !== confirmInput.value || passwordValue === '') {
    // Show error and stop the function
    errorMessage.textContent = 'Passwords do not match.'
    errorMessage.style.display = 'block'
    isValid = false
  }

  if (passwordValue === '') {
    passwordError.textContent = 'Please enter your password'
    isValid = false
  } else if (passwordValue.length <= 7 && passwordValue !== '') {
    passwordError.textContent = 'Weak Password. Password has to contain 8 or more characters.'
  }

  // The Final Decision: If anything was wrong, stop everything right here.
  if (!isValid) {
    return
  }

  console.log('Passwords match! Sending data...', formData)

  // Send to your /register route (using Fetch)
  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    if (response.ok) {
      alert('Account created! Redirecting to login...')
      window.location.href = 'login-page.html'
    } else {
      const data = await response.json()
      errorMessage.textContent = data.error || 'Registration failed.'
      errorMessage.style.display = 'block'
    }
  } catch (err) {
    console.error('Network error:', err)
  }
})

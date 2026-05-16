// --- PASSWORD VISIBILITY TOGGLES ---
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

// --- DOM ELEMENTS REGISTER ---
const registrationForm = document.getElementById('registrationForm')
const emailInput = document.getElementById('email')
const emailError = document.getElementById('emailError')
const nameInput = document.getElementById('name')
const nameError = document.getElementById('nameError')
const surnameInput = document.getElementById('surname')
const surnameError = document.getElementById('surnameError')
const passwordInput = document.getElementById('password')
const confirmInput = document.getElementById('confirmPassword')
const passwordError = document.getElementById('passwordError')
const studentNoInput = document.getElementById('idNumber')
const studentNoError = document.getElementById('studnoError')
const errorMessage = document.getElementById('error-message')

// New Title Elements
const roleStudent = document.getElementById('roleStudent')
const roleLecturer = document.getElementById('roleLecturer')
const titleFieldContainer = document.getElementById('titleFieldContainer')
const titleError = document.getElementById('titleError')

// --- DYNAMIC LECTURER TITLE TOGGLE ---
function toggleTitleField () {
  if (roleLecturer.checked) {
    titleFieldContainer.classList.remove('d-none')
  } else {
    titleFieldContainer.classList.add('d-none')
    // Clear title radios if they switch back to student
    document.querySelectorAll('input[name="titleOptions"]').forEach(radio => radio.checked = false)
    if (titleError) titleError.textContent = ''
  }
}

roleStudent.addEventListener('change', toggleTitleField)
roleLecturer.addEventListener('change', toggleTitleField)

// --- FORM SUBMISSION HANDLING ---
registrationForm.addEventListener('submit', async (event) => {
  // Prevent the page from refreshing
  event.preventDefault()

  const emailValue = emailInput.value.trim()
  const nameValue = nameInput.value.trim()
  const surnameValue = surnameInput.value.trim()
  const passwordValue = passwordInput.value.trim()
  const studentNoValue = studentNoInput.value.trim()

  // Correctly extract active role from checked radio input element
  const selectedRole = document.querySelector('input[name="roleOptions"]:checked').value

  // Clear any old errors from previous attempts
  emailError.textContent = ''
  nameError.textContent = ''
  surnameError.textContent = ''
  passwordError.textContent = ''
  studentNoError.textContent = ''
  if (titleError) titleError.textContent = ''
  errorMessage.style.display = 'none'
  errorMessage.textContent = ''

  // We assume the form is valid until proven otherwise
  let isValid = true

  // Check the Email for empty and correct email address format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailValue === '') {
    emailError.textContent = 'Please enter your email address.'
    isValid = false
  } else if (!emailRegex.test(emailValue)) {
    emailError.textContent = 'Please enter a valid email (e.g., name@example.com).'
    isValid = false
  }

  // Check the name for empty
  if (nameValue === '') {
    nameError.textContent = 'Please enter your name.'
    isValid = false
  }

  // Check the surname for empty
  if (surnameValue === '') {
    surnameError.textContent = 'Please enter your surname.'
    isValid = false
  }

  // Check the identification number for empty (Context-aware messaging)
  if (studentNoValue === '') {
    studentNoError.textContent = selectedRole === 'lecturer'
      ? 'Please enter your lecturer number.'
      : 'Please enter your student number.'
    isValid = false
  }

  // Lecturer Title Group Validation
  let selectedTitle = ''
  if (selectedRole === 'lecturer') {
    const activeTitleRadio = document.querySelector('input[name="titleOptions"]:checked')
    if (!activeTitleRadio) {
      if (titleError) titleError.textContent = 'Please select your lecturer title.'
      isValid = false
    } else {
      selectedTitle = activeTitleRadio.value
    }
  }

  // Compare the password fields
  if (passwordInput.value !== confirmInput.value || passwordValue === '') {
    errorMessage.textContent = 'Passwords do not match.'
    errorMessage.style.display = 'block'
    isValid = false
  }

  if (passwordValue === '') {
    passwordError.textContent = 'Please enter your password.'
    isValid = false
  } else if (passwordValue.length <= 7 && passwordValue !== '') {
    passwordError.textContent = 'Weak Password. Password has to contain 8 or more characters.'
  }

  // Stop everything right here if validation fails
  if (!isValid) {
    return
  }

  // Gather clean data object for fetch request payload
  const formData = {
    name: nameValue,
    surname: surnameValue,
    idNumber: studentNoValue,
    email: emailValue,
    role: selectedRole,
    title: selectedTitle, // Will be string value if lecturer, or empty string if student
    password: passwordInput.value
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    const result = await response.json()

    if (response.ok && result.success) {
      alert('Welcome to Synchro! Redirecting to login...')
      window.location.href = 'login-page.html'
    } else {
      // Show server-side error (e.g., "Email already exists")
      errorMessage.textContent = result.error || 'Registration failed.'
      errorMessage.style.display = 'block'
    }
  } catch (err) {
    console.error('Network error:', err)
    errorMessage.textContent = 'Unable to connect to server. Please try again later.'
    errorMessage.style.display = 'block'
  }
})

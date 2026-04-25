document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault() // Stop page from refreshing

  const username = document.getElementById('username').value
  const messageElement = document.getElementById('message')
  const togglePassword = document.querySelector('#togglePassword')
  const password = document.querySelector('#password')
  const passwordField = document.querySelector('#password')

  togglePassword.addEventListener('click', function () {
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password'
    passwordField.setAttribute('type', type)

    // Change the icon name inside the span
    this.textContent = type === 'password' ? 'visibility' : 'visibility_off'
  })

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    const data = await response.json()

    if (response.ok) {
      messageElement.style.color = 'green'
      messageElement.innerText = 'Login Successful! Redirecting...'
      // In a real app, you'd redirect here:
      // window.location.href = '/dashboard.html';
    } else {
      messageElement.style.color = 'red'
      messageElement.innerText = data.error || 'Login failed'
    }
  } catch (error) {
    messageElement.innerText = 'Error connecting to server.'
  }
})

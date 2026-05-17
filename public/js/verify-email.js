const params = new URLSearchParams(window.location.search)
const emailInput = document.getElementById('email')
const otpInput = document.getElementById('otp')
const messageEl = document.getElementById('verification-message')
const form = document.getElementById('verifyEmailForm')
const resendBtn = document.getElementById('resendOtpBtn')

if (emailInput && params.get('email')) {
  emailInput.value = params.get('email')
}

function showMessage (message, isError = true) {
  messageEl.textContent = message
  messageEl.classList.toggle('text-danger', isError)
  messageEl.classList.toggle('text-success', !isError)
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = emailInput.value.trim()
  const otp = otpInput.value.trim()
  if (!email || !otp) {
    showMessage('Please enter your email and OTP.')
    return
  }

  try {
    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    })
    const result = await response.json()

    if (!response.ok || !result.success) {
      showMessage(result.error || 'Invalid or expired OTP.')
      return
    }

    showMessage('Email verified. Redirecting to login...', false)
    setTimeout(() => {
      window.location.href = 'login-page.html'
    }, 800)
  } catch (error) {
    showMessage('Unable to verify right now. Please try again.')
  }
})

resendBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  if (!email) {
    showMessage('Please enter your email first.')
    return
  }

  try {
    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    const result = await response.json()
    const devOtpMessage = result.devOtp ? ` Local development OTP: ${result.devOtp}` : ''
    showMessage(`${result.message || 'If verification is needed, a new OTP has been sent.'}${devOtpMessage}`, !response.ok)
  } catch (error) {
    showMessage('Unable to resend OTP right now. Please try again.')
  }
})

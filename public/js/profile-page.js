// Helper: display messages
const msgDiv = document.getElementById('message');
function showMessage(text, type) {
  msgDiv.className = `message ${type}`;
  msgDiv.textContent = text;
  setTimeout(() => {
    msgDiv.className = 'message';
  }, 4000);
}

// Get current user from storage
const userData = sessionStorage.getItem('sychro_current_user') || localStorage.getItem('sychro_current_user');
let email = '';

if (userData) {
  try {
    const user = JSON.parse(userData);
    email = user.email;
  } catch(e) {
    console.error(e);
  }
}

// Load profile data
if (email) {
  fetch('/api/profile', { headers: { 'X-User-Email': email } })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        document.getElementById('name').value = d.user.name || '';
        document.getElementById('surname').value = d.user.surname || '';
        document.getElementById('phone').value = d.user.phone || '';
        document.getElementById('notificationsToggle').checked = d.user.notificationsEnabled !== false;
      } else {
        showMessage('Failed to load profile', 'error');
      }
    })
    .catch(() => showMessage('Error loading profile', 'error'));
} else {
  showMessage('User not logged in', 'error');
}
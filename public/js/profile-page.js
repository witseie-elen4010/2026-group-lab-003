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

// Save profile changes
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!email) return showMessage('User email missing', 'error');
  const body = {
    name: document.getElementById('name').value.trim(),
    surname: document.getElementById('surname').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    notificationsEnabled: document.getElementById('notificationsToggle').checked
  };
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Email': email },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showMessage('Profile updated successfully', 'success');
      // Update stored user name/surname
      if (userData) {
        let user = JSON.parse(userData);
        user.name = body.name;
        user.surname = body.surname;
        sessionStorage.setItem('sychro_current_user', JSON.stringify(user));
        localStorage.setItem('sychro_current_user', JSON.stringify(user));
      }
    } else {
      showMessage(data.message || 'Error updating profile', 'error');
    }
  } catch (err) {
    showMessage('Server error', 'error');
  }
});

// Determine user role and set cancel link
let isLecturer = false;
if (userData) {
  try {
    const user = JSON.parse(userData);
    isLecturer = (user.role === 'lecturer' || user.isLecturer || user.userType === 'lecturer');
  } catch(e) {}
}
const cancelLink = document.getElementById('cancel-link');
cancelLink.href = isLecturer ? "lecturer-dashboard.html" : "student-dashboard.html";

// Toggle change password form
const showPwdBtn = document.getElementById('showChangePwdBtn');
const pwdFormDiv = document.getElementById('changePwdForm');
const clearPwdFields = () => {
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmNewPassword').value = '';
};
showPwdBtn.addEventListener('click', () => {
  const isVisible = pwdFormDiv.style.display !== 'none';
  pwdFormDiv.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) clearPwdFields();
});

// Cancel password change
document.getElementById('cancelPwdChange').addEventListener('click', () => {
  pwdFormDiv.style.display = 'none';
  clearPwdFields();
});
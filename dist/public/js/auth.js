/* SafeReach - Authentication Controller */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const roleSelect = document.getElementById('reg-role');

  // Dynamic Role Form Fields Toggle on Registration Page
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      const selectedRole = e.target.value;
      const roleFields = document.querySelectorAll('.role-specific-field');
      roleFields.forEach(field => field.style.display = 'none');

      if (selectedRole === 'neighbor') {
        const f = document.getElementById('field-apartment');
        if (f) f.style.display = 'block';
      } else if (selectedRole === 'security_guard') {
        const f = document.getElementById('field-duty');
        if (f) f.style.display = 'block';
      } else if (selectedRole === 'volunteer') {
        const f = document.getElementById('field-availability');
        if (f) f.style.display = 'block';
      } else if (selectedRole === 'senior_citizen' || selectedRole === 'child') {
        const f = document.getElementById('field-medical');
        if (f) f.style.display = 'block';
      } else if (selectedRole === 'admin') {
        const f = document.getElementById('field-admin');
        if (f) f.style.display = 'block';
      }
    });
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const data = await SafeReach.api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        SafeReach.setToken(data.token);
        SafeReach.setUser(data.user);

        SafeReach.showToast(`Welcome back, ${data.user.name}!`, 'success');
        setTimeout(() => {
          if (data.user.role === 'admin') {
            SafeReach.navigate('/admin');
          } else {
            SafeReach.navigate('/dashboard');
          }
        }, 800);
      } catch (err) {
        SafeReach.showToast(err.message, 'danger');
      }
    });
  }

  // Handle Registration Submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const phone = document.getElementById('reg-phone').value;
      const password = document.getElementById('reg-password').value;
      const role = document.getElementById('reg-role').value;
      const address = document.getElementById('reg-address').value;
      const apartmentNumber = document.getElementById('reg-apartment')?.value || 'A-101';
      const medicalInfo = document.getElementById('reg-medical')?.value || '';

      try {
        const data = await SafeReach.api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            role,
            address,
            apartmentNumber,
            medicalInfo
          })
        });

        SafeReach.setToken(data.token);
        SafeReach.setUser(data.user);

        SafeReach.showToast(`Welcome back, ${data.user.name}! Account created successfully.`, 'success');
        setTimeout(() => {
          if (data.user.role === 'admin') {
            SafeReach.navigate('/admin');
          } else {
            SafeReach.navigate('/dashboard');
          }
        }, 800);
      } catch (err) {
        SafeReach.showToast(err.message, 'danger');
      }
    });
  }
});

// Quick Demo Login Helper
function quickDemoLogin(email) {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (emailInput && passwordInput) {
    emailInput.value = email;
    passwordInput.value = 'password123';
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
  }
}

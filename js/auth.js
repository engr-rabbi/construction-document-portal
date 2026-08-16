/**
 * auth.js — Google Identity Services দিয়ে সাইন-ইন এবং লোকাল session state।
 */
var Auth = (function () {
  var STORAGE_KEY = 'cdp_session_token';
  var USER_KEY = 'cdp_user';

  function getUser() {
    var raw = localStorage.getItem(USER_KEY);
    if (!raw) return { email: '', role: 'public', contractorId: '', contractorName: '', name: 'Guest' };
    try { return JSON.parse(raw); } catch (e) { return { role: 'public' }; }
  }

  function setSession(token, user) {
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    location.hash = '#/';
    location.reload();
  }

  function isLoggedIn() {
    return getUser().role !== 'public';
  }

  function isAdmin() { return getUser().role === 'admin'; }
  function isContractor() { return getUser().role === 'contractor'; }

  /** Google Identity Services লোড হওয়ার পর বাটন রেন্ডার করে */
  function renderSignInButton(containerEl, onLoggedIn) {
    if (!window.google || !google.accounts) {
      containerEl.innerHTML = '<p class="muted">Google Sign-In লোড হচ্ছে...</p>';
      setTimeout(function () { renderSignInButton(containerEl, onLoggedIn); }, 500);
      return;
    }
    google.accounts.id.initialize({
      client_id: window.APP_CONFIG.GOOGLE_CLIENT_ID,
      callback: function (response) {
        Api.post('login', { idToken: response.credential })
          .then(function (data) {
            setSession(data.token, data.user);
            if (onLoggedIn) onLoggedIn(data.user);
          })
          .catch(function (err) { alert('লগইন ব্যর্থ: ' + err.message); });
      }
    });
    google.accounts.id.renderButton(containerEl, { theme: 'filled_black', size: 'large', shape: 'pill' });
  }

  return {
    getUser: getUser,
    setSession: setSession,
    logout: logout,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    isContractor: isContractor,
    renderSignInButton: renderSignInButton
  };
})();

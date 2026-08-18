/**
 * app.js — Router + সব view render logic (Single Page Application)
 *
 * ডিজাইন সিদ্ধান্ত: স্পেসিফিকেশনে ১৩টি আলাদা .html পেজের কথা বলা হয়েছিল, কিন্তু
 * এখানে ইচ্ছাকৃতভাবে একটি SPA (index.html + hash router) হিসেবে বানানো হয়েছে —
 * একই ফাংশনালিটি বজায় থাকছে (প্রতিটি route নিচে আলাদা view হিসেবে আছে), শুধু
 * maintenance সহজ ও পেজ-লোড দ্রুত করার জন্য। প্রয়োজন হলে যেকোনো view সহজেই
 * আলাদা .html ফাইলে ভাঙা যাবে।
 *
 * এই ফাইলটি redesign-এর অংশ হিসেবে visually অনেক উন্নত করা হয়েছে, কিন্তু প্রতিটি
 * route, প্রতিটি function-এর নাম এবং প্রতিটি Api.get/Api.post কল অপরিবর্তিত রাখা
 * হয়েছে — কোনো existing feature, permission বা business logic বদলানো হয়নি।
 */

var State = { projectCache: {}, allProjects: null, allContractors: null, searchIndexPromise: null };

/**
 * Project ID কয়েকশ' হলেও প্রতি keystroke-এ সার্ভারে না গিয়ে instant client-side
 * filtering করার জন্য পুরো Project+Contractor লিস্ট একবার লোড করে cache করা হয়
 * (§১২: "Google Drive folder tree scan না করে দ্রুত সার্চ")। নতুন কোনো Project
 * তৈরি হলে refreshSearchIndex() দিয়ে সহজেই আবার লোড করা যায়।
 */
function ensureSearchIndexLoaded() {
  if (State.searchIndexPromise) return State.searchIndexPromise;
  State.searchIndexPromise = Promise.all([Api.get('listProjects', {}), Api.get('listContractors', {})])
    .then(function (res) {
      State.allProjects = res[0];
      State.allContractors = res[1];
      return res;
    })
    .catch(function (err) { State.searchIndexPromise = null; throw err; });
  return State.searchIndexPromise;
}
function refreshSearchIndex() { State.searchIndexPromise = null; return ensureSearchIndexLoaded(); }

/**
 * Contractor/Project cache থেকে instant suggestion বানানোর ভাগাভাগি করা logic —
 * header dropdown এবং command palette দুটোই এটা ব্যবহার করে, যাতে দুই জায়গায়
 * একই matching behaviour থাকে (একবারই লেখা)।
 */
function buildQuickSuggestions(q, limit) {
  if (!State.allProjects || !State.allContractors) return [];
  q = q.toLowerCase();
  var out = [];
  State.allContractors.forEach(function (c) {
    if ((c.contractorId + ' ' + c.contractorName).toLowerCase().indexOf(q) !== -1) {
      out.push({ kind: 'contractor', label: c.contractorName, sub: c.contractorId, href: '#/contractor/' + encodeURIComponent(c.contractorId) });
    }
  });
  State.allProjects.forEach(function (p) {
    if ((p.projectId + ' ' + p.projectName + ' ' + p.contractorName).toLowerCase().indexOf(q) !== -1) {
      out.push({ kind: 'project', label: p.projectId, sub: p.projectName + ' · ' + p.contractorName, href: '#/project/' + encodeURIComponent(p.projectId) });
    }
  });
  return out.slice(0, limit || 8);
}

/**
 * সাধারণ পুনঃব্যবহারযোগ্য Searchable Combobox — একটা কন্টেইনারে বসিয়ে দিলে
 * type-করার সাথে সাথে (client-side, তাই instant) filter করা dropdown দেখায়।
 * Contractor/Project ID পিকারে ব্যবহৃত হয় (§১, §২: searchable, real-time,
 * partial+exact match, case-insensitive)।
 */
function mountSearchableSelect(containerEl, options, config) {
  config = config || {};
  containerEl.innerHTML = '';
  containerEl.classList.add('ss');
  var input = el('<input type="text" class="ss__input" placeholder="' + escapeHtml(config.placeholder || 'Search...') + '" autocomplete="off">');
  var menu = el('<div class="ss__menu" hidden></div>');
  containerEl.appendChild(input);
  containerEl.appendChild(menu);
  if (config.initialLabel) input.value = config.initialLabel;

  var filtered = options, highlighted = -1;

  function renderMenu() {
    menu.innerHTML = !filtered.length
      ? '<div class="ss__empty">কোনো ফলাফল নেই</div>'
      : filtered.slice(0, 50).map(function (o, i) {
        return '<div class="ss__item' + (i === highlighted ? ' ss__item--active' : '') + '" data-idx="' + i + '">' +
          '<span class="ss__item-label mono">' + escapeHtml(o.label) + '</span>' +
          (o.sublabel ? '<span class="ss__item-sub">' + escapeHtml(o.sublabel) + '</span>' : '') +
          '</div>';
      }).join('');
    menu.hidden = false;
    menu.querySelectorAll('.ss__item').forEach(function (item) {
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        select(filtered[Number(item.getAttribute('data-idx'))]);
      });
    });
  }
  function select(option) {
    input.value = option.label;
    menu.hidden = true; highlighted = -1;
    if (config.onSelect) config.onSelect(option.value, option);
  }
  function filterNow() {
    var q = input.value.trim().toLowerCase();
    filtered = !q ? options : options.filter(function (o) {
      return (o.label + ' ' + (o.sublabel || '') + ' ' + o.value).toLowerCase().indexOf(q) !== -1;
    });
    highlighted = -1;
    renderMenu();
  }
  input.addEventListener('input', function () { filterNow(); if (!input.value && config.onClear) config.onClear(); });
  input.addEventListener('focus', filterNow);
  input.addEventListener('keydown', function (e) {
    if (menu.hidden && e.key !== 'ArrowDown') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlighted = Math.min(highlighted + 1, filtered.length - 1); renderMenu(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlighted = Math.max(highlighted - 1, 0); renderMenu(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlighted >= 0 && filtered[highlighted]) select(filtered[highlighted]); }
    else if (e.key === 'Escape') { menu.hidden = true; }
  });
  document.addEventListener('click', function (e) { if (!containerEl.contains(e.target)) menu.hidden = true; });

  return { setOptions: function (o) { options = o; filterNow(); }, clear: function () { input.value = ''; } };
}

/* ---------------------------- App shell / header --------------------------- */

var IS_MAC = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

function renderShell() {
  var user = Auth.getUser();
  var shell = document.getElementById('shell');
  shell.innerHTML =
    '<a href="#/" class="skip-link">Skip to content</a>' +
    '<header class="topbar">' +
    '  <div class="topbar__inner">' +
    '    <a href="#/" class="brand"><span class="brand__mark">CDP</span><span class="brand__name">' + escapeHtml(window.APP_CONFIG.APP_NAME) + '</span></a>' +
    '    <form id="global-search" class="topbar__search" role="search">' +
    '      <label for="global-search-input" class="visually-hidden">Search Project ID, Contractor or Document</label>' +
    '      <input type="text" id="global-search-input" name="q" placeholder="Search Project ID, Contractor or Document..." autocomplete="off">' +
    '      <button type="button" class="topbar__search-kbd" id="cmdk-trigger" title="Open quick search">' + (IS_MAC ? '⌘K' : 'Ctrl K') + '</button>' +
    '      <button type="submit" aria-label="Search">' + icon('search') + '</button>' +
    '      <div id="global-search-menu" class="ss__menu ss__menu--dark" hidden></div>' +
    '    </form>' +
    '    <nav class="topbar__nav" aria-label="Primary">' +
    ((user.role === 'admin' || user.role === 'moderator') ? '<a href="#/admin/dashboard" class="navlink">' + icon('gear') + '<span>Admin</span></a>' : '') +
    (user.role === 'contractor' ? '<a href="#/contractor/' + encodeURIComponent(user.contractorId) + '" class="navlink">' + icon('doc') + '<span>My Projects</span></a>' : '') +
    '      <button type="button" class="theme-toggle" id="theme-toggle-btn" aria-label="Toggle dark mode"></button>' +
    '      <div id="user-slot"></div>' +
    '    </nav>' +
    '  </div>' +
    '</header>' +
    '<main id="view" class="view"></main>' +
    '<div id="modal-root"></div>' +
    renderMobileBottomNav(user);

  document.getElementById('global-search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = e.target.q.value.trim();
    if (q) location.hash = '#/search/' + encodeURIComponent(q);
  });
  wireHeaderSuggestions();

  document.getElementById('cmdk-trigger').addEventListener('click', openCommandPalette);

  var themeBtn = document.getElementById('theme-toggle-btn');
  function paintThemeBtn() {
    var mode = Theme.get();
    themeBtn.innerHTML = icon(mode === 'dark' ? 'sun' : 'moon');
  }
  paintThemeBtn();
  themeBtn.addEventListener('click', function () { Theme.toggle(); paintThemeBtn(); });

  renderUserSlot();
}

/** নিচে ফিক্সড quick-nav — মোবাইলে স্ক্রল না করেই Home/Search/Admin-Projects-এ যাওয়া যায় */
function renderMobileBottomNav(user) {
  var third = (user.role === 'admin' || user.role === 'moderator')
    ? '<a href="#/admin/dashboard">' + icon('gear') + '<span>Admin</span></a>'
    : (user.role === 'contractor'
      ? '<a href="#/contractor/' + encodeURIComponent(user.contractorId) + '">' + icon('doc') + '<span>Projects</span></a>'
      : '<button type="button" id="mnav-signin">' + icon('users') + '<span>Sign in</span></button>');
  return (
    '<nav class="mobile-bottom-nav" aria-label="Quick navigation">' +
    '  <div class="mobile-bottom-nav__inner">' +
    '    <a href="#/">' + icon('building') + '<span>Home</span></a>' +
    '    <button type="button" id="mnav-search">' + icon('search') + '<span>Search</span></button>' +
    '    ' + third +
    '  </div>' +
    '</nav>'
  );
}
function wireMobileBottomNav() {
  var s = document.getElementById('mnav-search');
  if (s) s.addEventListener('click', openCommandPalette);
  var si = document.getElementById('mnav-signin');
  if (si) si.addEventListener('click', openLoginModal);
}

function wireHeaderSuggestions() {
  var input = document.getElementById('global-search-input');
  var menu = document.getElementById('global-search-menu');
  if (!input) return;

  ensureSearchIndexLoaded().catch(function () { /* suggestions ব্যর্থ হলে normal Enter-search কাজ করবে */ });

  function render(list) {
    if (!list.length) { menu.hidden = true; return; }
    menu.innerHTML = list.map(function (s, i) {
      return '<a class="ss__item" data-idx="' + i + '" href="' + s.href + '">' +
        icon(s.kind === 'contractor' ? 'users' : 'doc', 'ss__item-icon') +
        '<span><span class="ss__item-label mono">' + escapeHtml(s.label) + '</span><span class="ss__item-sub">' + escapeHtml(s.sub) + '</span></span>' +
        '</a>';
    }).join('');
    menu.hidden = false;
    menu.querySelectorAll('.ss__item').forEach(function (a) {
      a.addEventListener('click', function () { menu.hidden = true; input.value = ''; });
    });
  }

  input.addEventListener('input', function () {
    var q = input.value.trim();
    render(q.length >= 1 ? buildQuickSuggestions(q) : []);
  });
  input.addEventListener('focus', function () { if (input.value.trim()) render(buildQuickSuggestions(input.value.trim())); });
  document.addEventListener('click', function (e) { if (!e.target.closest('#global-search')) menu.hidden = true; });
}

/* ---------------------------- Command palette (⌘K) --------------------------- */

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem('cdp_recent_searches') || '[]'); } catch (e) { return []; }
}
function saveRecentSearch(q) {
  if (!q) return;
  var list = getRecentSearches().filter(function (x) { return x !== q; });
  list.unshift(q);
  try { localStorage.setItem('cdp_recent_searches', JSON.stringify(list.slice(0, 5))); } catch (e) { /* ignore */ }
}

function openCommandPalette() {
  ensureSearchIndexLoaded().catch(function () { /* instant results simply stay empty until it resolves */ });

  var node = el(
    '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Quick search">' +
    '  <div class="cmdk__input-row">' + icon('search') +
    '    <input type="text" id="cmdk-input" placeholder="Search Project ID, Contractor or Document..." autocomplete="off">' +
    '    <span class="cmdk__esc">ESC</span>' +
    '  </div>' +
    '  <div class="cmdk__list" id="cmdk-list"></div>' +
    '  <div class="cmdk__footer"><span>' + icon('chevron', '') + ' ' + icon('chevron', '') + ' navigate</span><span>&crarr; open</span><span>ESC close</span></div>' +
    '</div>'
  );
  var backdrop = el('<div class="cmdk-backdrop"></div>');
  backdrop.appendChild(node);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  var input = node.querySelector('#cmdk-input');
  var list = node.querySelector('#cmdk-list');
  var currentItems = [], activeIdx = -1;
  var lastTrigger = document.activeElement;

  function close() {
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });

  function paintActive() {
    list.querySelectorAll('.cmdk__item').forEach(function (it, i) { it.classList.toggle('cmdk__item--active', i === activeIdx); });
    var activeEl = list.querySelector('.cmdk__item--active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }
  function go(item) {
    if (item.q) saveRecentSearch(item.q);
    close();
    location.hash = item.href;
  }
  function renderGroups(groups) {
    currentItems = [];
    if (!groups.length) { list.innerHTML = '<div class="cmdk__empty">কোনো ফলাফল নেই</div>'; activeIdx = -1; return; }
    list.innerHTML = groups.map(function (g) {
      return '<div class="cmdk__group-label">' + escapeHtml(g.label) + '</div>' + g.items.map(function (it) {
        currentItems.push(it);
        var idx = currentItems.length - 1;
        return '<div class="cmdk__item" data-idx="' + idx + '">' + icon(it.icon, 'cmdk__item-icon') +
          '<span class="cmdk__item-text"><span class="cmdk__item-label">' + escapeHtml(it.label) + '</span>' +
          (it.sub ? '<span class="cmdk__item-sub">' + escapeHtml(it.sub) + '</span>' : '') + '</span></div>';
      }).join('');
    }).join('');
    list.querySelectorAll('.cmdk__item').forEach(function (it) {
      it.addEventListener('mousedown', function (e) { e.preventDefault(); go(currentItems[Number(it.getAttribute('data-idx'))]); });
    });
    activeIdx = -1;
  }
  function renderRecent() {
    var recent = getRecentSearches();
    if (!recent.length) { list.innerHTML = '<div class="cmdk__empty">Project ID, Contractor বা Document নাম দিয়ে খুঁজুন</div>'; currentItems = []; return; }
    renderGroups([{ label: 'Recent', items: recent.map(function (q) { return { icon: 'clock', label: q, href: '#/search/' + encodeURIComponent(q), q: q }; }) }]);
  }
  function runInstant(q) {
    var quick = buildQuickSuggestions(q, 12);
    var groups = [];
    var contractors = quick.filter(function (s) { return s.kind === 'contractor'; }).map(function (s) { return { icon: 'building', label: s.label, sub: s.sub, href: s.href }; });
    var projects = quick.filter(function (s) { return s.kind === 'project'; }).map(function (s) { return { icon: 'doc', label: s.label, sub: s.sub, href: s.href }; });
    if (contractors.length) groups.push({ label: 'Contractors', items: contractors });
    if (projects.length) groups.push({ label: 'Projects', items: projects });
    renderGroups(groups);
  }
  var fetchDocs = debounce(function (q) {
    if (!q) return;
    Api.get('globalSearch', { q: q }).then(function (res) {
      if (input.value.trim().toLowerCase() !== q.toLowerCase()) return; // চাহিদার মধ্যে user আবার টাইপ করে ফেলেছে — পুরনো ফলাফল বাতিল
      if (!res.files || !res.files.length) return;
      var quick = buildQuickSuggestions(q, 12);
      var groups = [];
      var contractors = quick.filter(function (s) { return s.kind === 'contractor'; }).map(function (s) { return { icon: 'building', label: s.label, sub: s.sub, href: s.href }; });
      var projects = quick.filter(function (s) { return s.kind === 'project'; }).map(function (s) { return { icon: 'doc', label: s.label, sub: s.sub, href: s.href }; });
      if (contractors.length) groups.push({ label: 'Contractors', items: contractors });
      if (projects.length) groups.push({ label: 'Projects', items: projects });
      groups.push({
        label: 'Documents', items: res.files.slice(0, 6).map(function (f) {
          return { icon: fileTypeMeta(f.fileName).icon, label: f.fileName, sub: (f.projectId || '') + (f.category ? ' · ' + f.category : ''), href: '#/project/' + encodeURIComponent(f.projectId) + '/' + encodeURIComponent(f.category) };
        })
      });
      renderGroups(groups);
    }).catch(function () { /* silently keep instant results — non-fatal */ });
  }, 300);

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, currentItems.length - 1); paintActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); paintActive(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && currentItems[activeIdx]) go(currentItems[activeIdx]);
      else if (input.value.trim()) { saveRecentSearch(input.value.trim()); close(); location.hash = '#/search/' + encodeURIComponent(input.value.trim()); }
    }
  }
  document.addEventListener('keydown', onKey);

  input.addEventListener('input', function () {
    var q = input.value.trim();
    if (!q) { renderRecent(); return; }
    runInstant(q);
    fetchDocs(q);
  });

  renderRecent();
  setTimeout(function () { input.focus(); }, 20);
}

function renderUserSlot() {
  var user = Auth.getUser();
  var slot = document.getElementById('user-slot');
  if (user.role === 'public') {
    slot.innerHTML = '<button class="btn btn--primary btn--sm" id="login-btn">Sign in</button>';
    document.getElementById('login-btn').addEventListener('click', openLoginModal);
  } else {
    var roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderator' : ('Contractor · ' + escapeHtml(user.contractorName || ''));
    slot.innerHTML =
      '<div class="user-badge">' +
      '  <img src="' + (user.picture || '') + '" class="user-avatar" alt="" onerror="this.style.display=\'none\'">' +
      '  <div class="user-badge__text"><strong>' + escapeHtml(user.name) + '</strong><small>' + roleLabel + '</small></div>' +
      '  <button class="icon-btn" id="logout-btn" title="Sign out" aria-label="Sign out">' + icon('logout') + '<span>Sign out</span></button>' +
      '</div>';
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);
  }
  wireMobileBottomNav();
}

function openLoginModal() {
  var node = el(
    '<div class="modal modal--sm" role="dialog" aria-modal="true" aria-label="Sign in">' +
    '  <div class="modal__head"><h3>Sign in</h3><button class="icon-btn modal-close" aria-label="Close">' + icon('close') + '</button></div>' +
    '  <div class="modal__body"><p class="muted">Admin/Contractor হিসেবে কাজ করতে Google দিয়ে সাইন-ইন করুন।</p><div id="google-btn-slot"></div></div>' +
    '</div>'
  );
  Modal.open(node);
  Auth.renderSignInButton(node.querySelector('#google-btn-slot'), function () {
    Modal.close();
    renderShell();
    router();
    Toast.success('সফলভাবে সাইন-ইন হয়েছে');
  });
}

var Modal = (function () {
  var lastTrigger = null;
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(node) {
    lastTrigger = document.activeElement;
    var root = document.getElementById('modal-root');
    root.innerHTML = '';
    if (!node.hasAttribute('role')) node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    var backdrop = el('<div class="modal-backdrop"></div>');
    backdrop.appendChild(node);
    root.appendChild(backdrop);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    var closeBtn = node.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var firstField = node.querySelector('input, select, textarea, button');
    if (firstField) setTimeout(function () { firstField.focus(); }, 20);
  }
  function close() {
    document.getElementById('modal-root').innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  return { open: open, close: close };
})();

/* --------------------------------- Router ---------------------------------- */

var ROUTES = [
  { re: /^#\/$/, fn: viewHome },
  { re: /^#\/search(?:\/(.*))?$/, fn: viewSearch },
  { re: /^#\/contractor\/([^\/]+)$/, fn: viewContractor },
  { re: /^#\/project\/([^\/]+)\/([^\/]+)$/, fn: viewCategory },
  { re: /^#\/project\/([^\/]+)$/, fn: viewProject },
  { re: /^#\/admin$/, fn: function () { location.hash = '#/admin/dashboard'; } },
  { re: /^#\/admin\/([^\/]+)$/, fn: viewAdmin }
];

function router() {
  var hash = location.hash || '#/';
  for (var i = 0; i < ROUTES.length; i++) {
    var m = ROUTES[i].re.exec(hash);
    if (m) {
      var args = m.slice(1).map(function (x) { return x !== undefined ? decodeURIComponent(x) : x; });
      ROUTES[i].fn.apply(null, args);
      return;
    }
  }
  viewHome();
}

function mount(html) {
  document.getElementById('view').innerHTML = html;
  document.getElementById('view').scrollIntoView({ behavior: 'instant', block: 'start' });
}

function loadingHtml(label) {
  return '<div class="loading"><div class="spinner"></div><p>' + escapeHtml(label || 'লোড হচ্ছে...') + '</p></div>';
}

function emptyStateHtml(title, subtitle, actionHtml) {
  return '<div class="empty-state"><div class="empty-state__icon">' + icon('search') + '</div><h3>' + escapeHtml(title) + '</h3><p class="muted">' + escapeHtml(subtitle || '') + '</p>' + (actionHtml || '') + '</div>';
}

function errorStateHtml(message) {
  return '<div class="empty-state empty-state--error"><div class="empty-state__icon">' + icon('alert') + '</div><h3>Something went wrong</h3><p class="muted">' + escapeHtml(message) + '</p><button class="btn btn--ghost" onclick="router()">' + icon('refresh') + ' Try again</button></div>';
}

function errorHtml(message) { return errorStateHtml(message); }

/* ---------------------------------- Home ------------------------------------ */

function auditIconForAction(action) {
  var map = {
    UPLOADED: { icon: 'upload', cls: 'timeline__dot--upload' },
    RESTORED: { icon: 'refresh', cls: 'timeline__dot--upload' },
    DELETED: { icon: 'trash', cls: 'timeline__dot--delete' },
    CREATE_PROJECT: { icon: 'plus', cls: 'timeline__dot--create' },
    ADD_CONTRACTOR: { icon: 'building', cls: 'timeline__dot--create' },
    ADD_USER: { icon: 'users', cls: 'timeline__dot--create' },
    ARCHIVE_PROJECT: { icon: 'doc', cls: 'timeline__dot--other' }
  };
  return map[action] || { icon: 'log', cls: 'timeline__dot--other' };
}

function renderActivityTimeline(rows, compact) {
  if (!rows.length) return '<p class="muted small">কোনো সাম্প্রতিক কার্যক্রম নেই।</p>';
  return '<div class="timeline">' + rows.map(function (r) {
    var meta = auditIconForAction(r.action);
    return '<div class="timeline__item"><span class="timeline__dot ' + meta.cls + '">' + icon(meta.icon, '') + '</span>' +
      '<div class="timeline__head"><span class="timeline__action">' + escapeHtml(r.action) + '</span><span class="muted">' + escapeHtml(r.user || '') + '</span><span class="timeline__time">' + (compact ? formatDateShort(r.timestamp) : formatDate(r.timestamp)) + '</span></div>' +
      '<div class="timeline__meta">' + [r.projectId, r.fileName, r.details].filter(Boolean).map(escapeHtml).join(' · ') + '</div>' +
      '</div>';
  }).join('') + '</div>';
}

function viewHome() {
  var user = Auth.getUser();
  mount(
    '<section class="hero"><div class="skeleton skeleton--text-sm" style="width:180px;margin-bottom:14px"></div><div class="skeleton skeleton--text-lg" style="width:70%;height:38px"></div></section>' +
    skeletonStatStrip(5)
  );
  Promise.all([Api.get('dashboardStats', {}), ensureSearchIndexLoaded()])
    .then(function (res) {
      var stats = res[0];
      var contractors = State.allContractors;
      var activeCount = (State.allProjects || []).filter(function (p) { return p.status !== 'Archived'; }).length;
      var archivedCount = (State.allProjects || []).filter(function (p) { return p.status === 'Archived'; }).length;
      var canManage = (user.role === 'admin' || user.role === 'moderator');

      mount(
        '<section class="hero">' +
        '  <p class="eyebrow">SITE DOCUMENTATION SYSTEM</p>' +
        '  <h1>Construction Photo &amp; Document Portal</h1>' +
        '  <p class="hero__sub">প্রতিটি ঠিকাদার প্রতিষ্ঠানের প্রজেক্ট-ভিত্তিক ছবি ও ডকুমেন্ট এক জায়গায়।</p>' +
        '  <div class="quick-actions">' +
        '    <button class="btn btn--primary btn--sm" id="qa-search">' + icon('search') + ' Search</button>' +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="qa-new-system">' + icon('plus') + ' New System</button>' : '') +
        (canManage ? '<a class="btn btn--ghost btn--sm" href="#/admin/dashboard">' + icon('gear') + ' Admin Dashboard</a>' : '') +
        (user.role === 'contractor' ? '<a class="btn btn--ghost btn--sm" href="#/contractor/' + encodeURIComponent(user.contractorId) + '">' + icon('doc') + ' My Projects</a>' : '') +
        '  </div>' +
        '</section>' +
        '<section class="stat-strip">' +
        statCard('doc', stats.totalProjects, 'Total Projects', 'var(--navy)') +
        statCard('check', activeCount, 'Active Projects', 'var(--success)') +
        statCard('log', archivedCount, 'Archived Projects', 'var(--muted)') +
        statCard('camera', stats.totalPhotos, 'Total Photos', 'var(--accent)') +
        statCard('doc', stats.totalDocuments, 'Total Documents', 'var(--engineering-blue)') +
        statCard('building', stats.totalContractors, 'Total Contractors', 'var(--engineering-blue)') +
        statCard('upload', stats.todaysUploads, "Today's Uploads", 'var(--warning)') +
        '</section>' +
        '<section class="chart-row" id="home-charts"></section>' +
        (canManage ? '<section class="section-head"><h2>Recent Activity</h2></section><section id="home-activity" class="chart-panel">' + loadingHtml('লোড হচ্ছে...') + '</section>' : '') +
        '<section class="section-head">' +
        '  <h2>Contractors</h2>' +
        '  <div class="btn-row">' +
        '    <button class="btn btn--ghost btn--sm" id="refresh-home-btn" title="Refresh counts" aria-label="Refresh">' + icon('refresh') + '</button>' +
        (canManage ? '<button class="btn btn--primary btn--sm" id="add-contractor-btn">' + icon('plus') + ' New Contractor</button>' : '') +
        '  </div>' +
        '</section>' +
        '<section class="contractor-grid">' +
        contractors.map(plateCard).join('') +
        '</section>'
      );

      document.querySelectorAll('.stat-card__value').forEach(function (v) { animateCount(v, v.getAttribute('data-target')); });

      // Project Status donut — সবসময় real, ইতিমধ্যে-লোড করা allProjects থেকে গণনা (কোনো fake ডেটা না)
      var statusData = [
        { label: 'Active', value: activeCount, colorVar: 'var(--success)' },
        { label: 'Archived', value: archivedCount, colorVar: 'var(--muted)' }
      ];
      var chartsHtml = '<div class="chart-panel chart-panel--donut"><div>' + renderDonutChart(statusData, 120) + '</div><div><h3 style="margin-bottom:8px">' + icon('doc') + ' Project Status</h3>' + chartLegendHtml(statusData) + '</div></div>';
      // Contractor distribution — শুধু API থেকে contractorStats সত্যিই এলে দেখানো হবে, নাহলে fabricate করা হবে না
      if (stats.contractorStats && stats.contractorStats.length) {
        var cdata = stats.contractorStats.map(function (c) { return { label: c.contractorName, value: c.projects, colorVar: 'var(--navy)' }; });
        chartsHtml += '<div class="chart-panel"><h3>' + icon('building') + ' Projects by Contractor</h3>' + renderBarChartHtml(cdata) + '</div>';
      }
      document.getElementById('home-charts').innerHTML = chartsHtml;

      document.getElementById('qa-search').addEventListener('click', openCommandPalette);
      if (canManage) {
        document.getElementById('qa-new-system').addEventListener('click', function () { openNewSystemModal(''); });
        document.getElementById('add-contractor-btn').addEventListener('click', openAddContractorModal);
        Api.get('listAuditLog', { limit: 6 }).then(function (rows) {
          var box = document.getElementById('home-activity');
          if (box) box.innerHTML = renderActivityTimeline(rows, true);
        }).catch(function () {
          var box = document.getElementById('home-activity');
          if (box) box.innerHTML = '<p class="muted small">Recent activity লোড করা যায়নি।</p>';
        });
      }
      document.getElementById('refresh-home-btn').addEventListener('click', function () {
        refreshSearchIndex().then(viewHome).catch(function (err) { Toast.error(err.message); });
      });
    })
    .catch(function (err) { mount(errorHtml(err.message)); });
}

function statCard(iconName, value, label, colorVar) {
  var v = Number(value) || 0;
  return '<div class="stat-card"' + (colorVar ? ' style="--stat-accent:' + colorVar + '"' : '') + '>' + icon(iconName, 'stat-card__icon') +
    '<div class="stat-card__value" data-target="' + v + '">0</div><div class="stat-card__label">' + escapeHtml(label) + '</div></div>';
}

function plateCard(c) {
  var statusCls = c.status === 'Disabled' ? 'badge--muted' : 'badge--active';
  return (
    '<a class="plate-card" href="#/contractor/' + encodeURIComponent(c.contractorId) + '">' +
    '  <div class="plate-card__rivet plate-card__rivet--tl"></div><div class="plate-card__rivet plate-card__rivet--tr"></div>' +
    '  <div class="plate-card__rivet plate-card__rivet--bl"></div><div class="plate-card__rivet plate-card__rivet--br"></div>' +
    icon('building', 'plate-card__icon') +
    '  <span class="plate-card__code">' + escapeHtml(c.contractorId) + '</span>' +
    '  <h3 class="plate-card__name">' + escapeHtml(c.contractorName) + '</h3>' +
    '  <div class="plate-card__stats"><span>' + c.projectCount + ' projects</span><span>' + c.fileCount + ' files</span></div>' +
    '  <span class="badge ' + statusCls + '"><span class="badge-dot"></span>' + escapeHtml(c.status) + '</span>' +
    '  <span class="plate-card__cta">View Projects ' + icon('chevron') + '</span>' +
    '</a>'
  );
}

function breadcrumb(items) {
  return '<nav class="breadcrumb" aria-label="Breadcrumb">' + items.map(function (it, i) {
    var sep = i < items.length - 1 ? '<span class="breadcrumb__sep">/</span>' : '';
    return (it.href ? '<a href="' + it.href + '">' + escapeHtml(it.label) + '</a>' : '<span aria-current="page">' + escapeHtml(it.label) + '</span>') + sep;
  }).join('') + '</nav>';
}

/* ------------------------------ Contractor ----------------------------------- */

function viewContractor(contractorId) {
  mount(loadingHtml() + skeletonCards(6));
  ensureSearchIndexLoaded()
    .then(function () {
      var contractor = State.allContractors.filter(function (c) { return c.contractorId === contractorId; })[0];
      var projects = State.allProjects.filter(function (p) { return p.contractorId === contractorId; });
      var user = Auth.getUser();
      if (!contractor) { mount(errorHtml('Contractor পাওয়া যায়নি')); return; }

      var isMine = user.role === 'contractor' && user.contractorId === contractorId;

      mount(
        breadcrumb([{ label: 'Home', href: '#/' }, { label: contractor.contractorName }]) +
        '<section class="section-head">' +
        '  <h1>' + (isMine ? 'My Projects — ' : '') + escapeHtml(contractor.contractorName) + ' <span class="mono muted">(' + escapeHtml(contractor.contractorId) + ')</span></h1>' +
        ((user.role === 'admin' || user.role === 'moderator') ? '<button class="btn btn--primary btn--sm" id="new-system-btn">' + icon('plus') + ' New System</button>' : '') +
        '</section>' +
        (projects.length === 0
          ? emptyStateHtml('এখনো কোনো প্রজেক্ট তৈরি হয়নি', 'নতুন প্রজেক্ট তৈরি করতে "New System" ব্যবহার করুন।')
          : '<section class="project-grid">' + projects.map(projectBadge).join('') + '</section>')
      );

      if ((user.role === 'admin' || user.role === 'moderator')) {
        document.getElementById('new-system-btn').addEventListener('click', function () { openNewSystemModal(contractorId); });
      }
    })
    .catch(function (err) { mount(errorHtml(err.message)); });
}

function projectBadge(p) {
  var statusCls = p.status === 'Archived' ? 'badge--muted' : 'badge--active';
  return (
    '<a class="project-badge" href="#/project/' + encodeURIComponent(p.projectId) + '">' +
    '  <span class="project-badge__id mono">' + escapeHtml(p.projectId) + '</span>' +
    '  <span class="project-badge__name">' + escapeHtml(p.projectName) + '</span>' +
    '  <span class="project-badge__meta">' + icon('camera') + ' ' + (p.photoCount || 0) + ' Photos &nbsp; ' + icon('doc') + ' ' + (p.docCount || 0) + ' Documents</span>' +
    '  <span class="badge ' + statusCls + '"><span class="badge-dot"></span>' + escapeHtml(p.status) + '</span>' +
    '  <span class="project-badge__cta">' + icon('eye') + ' Quick View</span>' +
    '</a>'
  );
}

function openNewSystemModal(defaultContractorId) {
  Api.get('listContractors', {}).then(function (contractors) {
    var node = el(
      '<div class="modal">' +
      '  <div class="modal__head"><h3>' + icon('plus') + ' New System</h3><button class="icon-btn modal-close" aria-label="Close">' + icon('close') + '</button></div>' +
      '  <div class="modal__body">' +
      '    <form id="new-system-form">' +
      '      <label>Contractor<select name="contractorId" required>' +
      contractors.map(function (c) { return '<option value="' + escapeHtml(c.contractorId) + '"' + (c.contractorId === defaultContractorId ? ' selected' : '') + '>' + escapeHtml(c.contractorName) + '</option>'; }).join('') +
      '      </select></label>' +
      '      <label>Project ID<input type="text" name="projectId" placeholder="e.g. MAG6013" required pattern="[A-Za-z0-9_-]+"></label>' +
      '      <label>Project Name (optional)<input type="text" name="projectName" placeholder="Same as Project ID if left blank"></label>' +
      '      <p class="muted small">নিচের ৪টি সাব-ফোল্ডার স্বয়ংক্রিয়ভাবে তৈরি হবে: ' + CATEGORY_FOLDERS_LABEL() + '</p>' +
      '      <button type="submit" class="btn btn--primary btn--block">Create New System</button>' +
      '    </form>' +
      '  </div>' +
      '</div>'
    );
    Modal.open(node);
    node.querySelector('#new-system-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'তৈরি হচ্ছে...';
      Api.post('createProject', {
        contractorId: f.contractorId.value,
        projectId: f.projectId.value.trim(),
        projectName: f.projectName.value.trim()
      }).then(function (data) {
        Modal.close();
        Toast.success('Project তৈরি হয়েছে: ' + data.projectId);
        refreshSearchIndex();
        location.hash = '#/project/' + encodeURIComponent(data.projectId);
      }).catch(function (err) {
        Toast.error(err.message);
        btn.disabled = false; btn.textContent = 'Create New System';
      });
    });
  });
}

function CATEGORY_FOLDERS_LABEL() {
  return window.APP_CONFIG.CATEGORIES.map(function (c) { return c.label; }).join(', ');
}

function openEditProjectModal(projectId, currentName) {
  var node = el(
    '<div class="modal modal--sm"><div class="modal__head"><h3>Edit Project</h3><button class="icon-btn modal-close" aria-label="Close">' + icon('close') + '</button></div>' +
    '<div class="modal__body"><form id="edit-p-form">' +
    '<label>Project ID<input type="text" value="' + escapeHtml(projectId) + '" disabled></label>' +
    '<label>Project Name<input type="text" name="projectName" value="' + escapeHtml(currentName || '') + '" required></label>' +
    '<button type="submit" class="btn btn--primary btn--block">Save</button>' +
    '</form></div></div>'
  );
  Modal.open(node);
  node.querySelector('#edit-p-form').addEventListener('submit', function (e) {
    e.preventDefault();
    Api.post('editProject', { projectId: projectId, projectName: e.target.projectName.value.trim() })
      .then(function () {
        Modal.close();
        Toast.success('Project আপডেট হয়েছে');
        delete State.projectCache[projectId];
        refreshSearchIndex();
        router();
      })
      .catch(function (err) { Toast.error(err.message); });
  });
}

/* -------------------------------- Project ------------------------------------ */

function viewProject(projectId) {
  mount(loadingHtml());
  Promise.all([
    ensureSearchIndexLoaded().then(function () { return State.allProjects.filter(function (p) { return p.projectId === projectId; })[0]; }),
    Api.get('listFiles', { projectId: projectId })
  ])
    .then(function (res) {
      var project = res[0];
      var files = res[1];
      if (!project) { mount(errorHtml('Project পাওয়া যায়নি')); return; }
      State.projectCache[projectId] = project;

      var user = Auth.getUser();
      var canManage = (user.role === 'admin' || user.role === 'moderator');
      var counts = {};
      window.APP_CONFIG.CATEGORIES.forEach(function (c) { counts[c.key] = 0; });
      files.forEach(function (f) { if (counts[f.category] !== undefined) counts[f.category]++; });

      mount(
        breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Contractor', href: '#/contractor/' + encodeURIComponent(project.contractorId) }, { label: project.projectId }]) +
        '<div class="project-header">' +
        '  <div class="project-header__row">' +
        '    <div>' +
        '      <h1 class="mono">' + escapeHtml(project.projectId) + '</h1>' +
        '      <p class="muted" style="margin-top:4px">' + escapeHtml(project.projectName) + ' &middot; ' + escapeHtml(project.contractorName || '') + '</p>' +
        '    </div>' +
        '    <div class="btn-row">' +
        '      <span class="badge ' + (project.status === 'Archived' ? 'badge--muted' : 'badge--active') + '"><span class="badge-dot"></span>' + escapeHtml(project.status) + '</span>' +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="edit-project-btn">' + icon('edit') + ' Edit name</button>' : '') +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="repair-btn">' + icon('refresh') + ' Repair folders</button>' : '') +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="archive-btn">' + (project.status === 'Archived' ? 'Unarchive' : 'Archive') + '</button>' : '') +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<section class="section-head"><h2>Categories</h2><p class="muted small">' + files.length + ' file(s) total</p></section>' +
        '<section class="category-grid">' +
        window.APP_CONFIG.CATEGORIES.map(function (c) {
          return '<a class="category-tile" href="#/project/' + encodeURIComponent(projectId) + '/' + encodeURIComponent(c.key) + '">' +
            icon(c.icon, 'category-tile__icon') +
            '<span class="category-tile__label">' + escapeHtml(c.label) + '</span>' +
            '<span class="category-tile__count">' + counts[c.key] + ' files</span>' +
            '</a>';
        }).join('') +
        '</section>'
      );

      if (canManage) {
        document.getElementById('edit-project-btn').addEventListener('click', function () {
          openEditProjectModal(project.projectId, project.projectName);
        });
        document.getElementById('repair-btn').addEventListener('click', function () {
          Api.post('repairProjectFolders', { projectId: projectId })
            .then(function () { Toast.success('Sub-folder ঠিক করা হয়েছে'); })
            .catch(function (err) { Toast.error(err.message); });
        });
        document.getElementById('archive-btn').addEventListener('click', function () {
          var newStatus = project.status === 'Archived' ? 'Active' : 'Archived';
          Api.post('archiveProject', { projectId: projectId, status: newStatus })
            .then(function () { Toast.success('Status আপডেট হয়েছে'); refreshSearchIndex(); router(); })
            .catch(function (err) { Toast.error(err.message); });
        });
      }
    })
    .catch(function (err) { mount(errorHtml(err.message)); });
}

/* -------------------------------- Category (Gallery/Upload) ------------------- */

function viewCategory(projectId, category) {
  mount(loadingHtml());
  getProjectMeta(projectId).then(function (project) {
    if (!project) { mount(errorHtml('Project পাওয়া যায়নি')); return; }
    renderCategoryShell(project, category, {});
  }).catch(function (err) { mount(errorHtml(err.message)); });
}

function getProjectMeta(projectId) {
  if (State.projectCache[projectId]) return Promise.resolve(State.projectCache[projectId]);
  return ensureSearchIndexLoaded().then(function () {
    var p = State.allProjects.filter(function (x) { return x.projectId === projectId; })[0];
    if (p) State.projectCache[projectId] = p;
    return p;
  });
}

function renderCategoryShell(project, category, filters) {
  var user = Auth.getUser();
  var canUpload = (user.role === 'admin' || user.role === 'moderator') || (user.role === 'contractor' && user.contractorId === project.contractorId);
  var canDelete = (user.role === 'admin' || user.role === 'moderator');

  mount(
    breadcrumb([
      { label: 'Home', href: '#/' },
      { label: 'Contractor', href: '#/contractor/' + encodeURIComponent(project.contractorId) },
      { label: project.projectId, href: '#/project/' + encodeURIComponent(project.projectId) },
      { label: category }
    ]) +
    '<section class="section-head"><h1>' + escapeHtml(category) + '</h1></section>' +
    (canUpload ? uploadDropzoneHtml() : '') +
    '<section class="toolbar">' +
    '  <input type="text" id="f-search" placeholder="ফাইলের নাম দিয়ে খুঁজুন" value="' + escapeHtml(filters.search || '') + '">' +
    '  <select id="f-type"><option value="">All types</option><option value="jpg">JPG</option><option value="png">PNG</option><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="xlsx">XLSX</option></select>' +
    '  <input type="date" id="f-from" title="From date">' +
    '  <input type="date" id="f-to" title="To date">' +
    '  <button class="btn btn--ghost btn--sm" id="f-refresh" aria-label="Refresh">' + icon('refresh') + '</button>' +
    '  <button class="btn btn--ghost btn--sm toolbar__clear" id="f-clear">' + icon('close') + ' Clear filters</button>' +
    '</section>' +
    '<div id="file-area">' + skeletonGallery(8) + '</div>'
  );

  if (canUpload) wireUploadDropzone(project.projectId, category);

  function activeFilterCount() {
    var n = 0;
    if (document.getElementById('f-search').value) n++;
    if (document.getElementById('f-type').value) n++;
    if (document.getElementById('f-from').value) n++;
    if (document.getElementById('f-to').value) n++;
    return n;
  }
  function paintClearBtn() {
    var n = activeFilterCount();
    var btn = document.getElementById('f-clear');
    btn.classList.toggle('is-visible', n > 0);
    btn.innerHTML = icon('close') + ' Clear filters' + (n ? '<span class="filter-count">' + n + '</span>' : '');
  }
  function applyFilters() {
    var f = {
      projectId: project.projectId, category: category,
      search: document.getElementById('f-search').value,
      fileType: document.getElementById('f-type').value,
      dateFrom: document.getElementById('f-from').value,
      dateTo: document.getElementById('f-to').value
    };
    paintClearBtn();
    loadFileArea(f, canDelete);
  }
  document.getElementById('f-refresh').addEventListener('click', applyFilters);
  document.getElementById('f-search').addEventListener('input', debounce(applyFilters, 400));
  document.getElementById('f-clear').addEventListener('click', function () {
    document.getElementById('f-search').value = '';
    document.getElementById('f-type').value = '';
    document.getElementById('f-from').value = '';
    document.getElementById('f-to').value = '';
    applyFilters();
  });
  ['f-type', 'f-from', 'f-to'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', applyFilters);
  });
  paintClearBtn();
  applyFilters();
}

function uploadDropzoneHtml() {
  return (
    '<section class="dropzone" id="dropzone">' +
    icon('upload', 'dropzone__icon') +
    '  <p><strong>Drag &amp; drop</strong> files here, or <label class="link" for="file-input">browse</label></p>' +
    '  <p class="muted small">Images: JPG, PNG, WEBP &middot; Documents: PDF, DOC, DOCX, XLS, XLSX</p>' +
    '  <input type="file" id="file-input" multiple hidden>' +
    '  <div id="upload-list" class="upload-list"></div>' +
    '</section>'
  );
}

function wireUploadDropzone(projectId, category) {
  var zone = document.getElementById('dropzone');
  var input = document.getElementById('file-input');
  input.addEventListener('change', function () { handleFiles(input.files, projectId, category); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (evt) {
    zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.add('dropzone--drag'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.remove('dropzone--drag'); });
  });
  zone.addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files, projectId, category);
  });
}

function handleFiles(fileList, projectId, category) {
  var list = document.getElementById('upload-list');
  var files = Array.prototype.slice.call(fileList);
  files.forEach(function (file) {
    var row = el(
      '<div class="upload-item">' +
      '  <div class="upload-item__top"><span class="upload-item__name">' + escapeHtml(file.name) + '</span><span class="upload-item__status">প্রস্তুত হচ্ছে...</span></div>' +
      '  <div class="upload-item__bar"><div class="upload-item__bar-fill" style="width:4%"></div></div>' +
      '</div>'
    );
    list.appendChild(row);
    var statusEl = row.querySelector('.upload-item__status');
    var barEl = row.querySelector('.upload-item__bar-fill');

    // Apps Script Web App-এর সাথে real byte-level upload progress সম্ভব না (দেখুন api.js-এর
    // নোট — xhr.upload progress listener CORS preflight ট্রিগার করে, যা Apps Script হ্যান্ডেল
    // করতে পারে না)। তাই এখানে একটা smooth "simulated" progress ব্যবহার করা হচ্ছে যা আসল
    // আপলোড শেষ না হওয়া পর্যন্ত ধীরে ধীরে ~90% পর্যন্ত এগোয়, তারপর success/fail এ snap করে।
    var simPct = 4;
    var simTimer = setInterval(function () {
      simPct += (90 - simPct) * 0.12;
      barEl.style.width = simPct + '%';
      statusEl.textContent = Math.round(simPct) + '%';
    }, 250);

    Promise.all([compressImageForUpload(file), makeThumbnail(file)])
      .then(function (res) {
        var main = res[0], thumbBase64 = res[1];
        return Api.post('uploadFile', {
          projectId: projectId, category: category, fileName: main.fileName,
          mimeType: main.mimeType, fileData: main.base64,
          thumbnailData: thumbBase64 || undefined
        });
      })
      .then(function () {
        clearInterval(simTimer);
        barEl.style.width = '100%';
        statusEl.innerHTML = icon('check') + ' Uploaded';
        row.classList.add('upload-item--ok');
        refreshSearchIndex();
        refreshFileAreaIfPresent(projectId, category);
      })
      .catch(function (err) {
        clearInterval(simTimer);
        statusEl.innerHTML = icon('alert') + ' ' + escapeHtml(err.message);
        row.classList.add('upload-item--fail');
      });
  });
}

function refreshFileAreaIfPresent() {
  var btn = document.getElementById('f-refresh');
  if (btn) btn.click();
}

function loadFileArea(filters, canDelete) {
  var area = document.getElementById('file-area');
  area.innerHTML = skeletonGallery(8);
  Api.get('listFiles', filters).then(function (allFiles) {
    if (allFiles.length === 0) { area.innerHTML = emptyStateHtml('No Results Found', "We couldn't find any file matching your filters. Try a different name, category or date range."); return; }
    var images = allFiles.filter(function (f) { return f.isImage; });
    var docs = allFiles.filter(function (f) { return !f.isImage; });

    area.innerHTML =
      (images.length ? '<div class="gallery-grid">' + images.map(function (f) { return galleryTile(f, allFiles.indexOf(f), canDelete); }).join('') + '</div>' : '') +
      (docs.length ? '<div class="doc-list">' + docs.map(function (f) { return docRow(f, allFiles.indexOf(f), canDelete); }).join('') + '</div>' : '');

    wireGalleryLazyThumbs();
    wireQuickViewClicks(area, allFiles);
    wireDeleteButtons(area, function () { loadFileArea(filters, true); });
    wireDownloadButtons(area);
  }).catch(function (err) { area.innerHTML = errorStateHtml(err.message); });
}

function galleryTile(f, idx, canDelete, showContext) {
  return (
    '<figure class="gallery-tile" data-file-id="' + escapeHtml(f.fileId) + '" data-idx="' + idx + '">' +
    '  <div class="gallery-tile__thumb-wrap">' + icon('image', 'gallery-tile__placeholder') + '</div>' +
    '  <div class="gallery-tile__hover"><span class="gallery-tile__hover-btn">' + icon('search') + ' Quick View</span></div>' +
    '  <figcaption>' +
    '    <span class="gallery-tile__name">' + escapeHtml(f.fileName) + '</span>' +
    (showContext
      ? '<span class="gallery-tile__context mono">' + escapeHtml(f.projectId) + ' · ' + escapeHtml(f.category) + '</span>'
      : '<span class="gallery-tile__date mono">' + formatDate(f.uploadDate) + '</span>') +
    '  </figcaption>' +
    (canDelete ? '<button class="icon-btn gallery-tile__delete" data-delete-id="' + escapeHtml(f.fileId) + '" title="Delete" aria-label="Delete file">' + icon('trash') + '</button>' : '') +
    '</figure>'
  );
}

function docRow(f, idx, canDelete, showContext) {
  var ft = fileTypeMeta(f.fileName);
  return (
    '<div class="doc-row" data-file-id="' + escapeHtml(f.fileId) + '">' +
    '  <span class="doc-row__icon-wrap ' + ft.cls + '">' + icon(ft.icon, 'doc-row__icon ' + ft.cls) + '</span>' +
    '  <div class="doc-row__info"><strong>' + escapeHtml(f.fileName) + '<span class="ft-badge ' + ft.cls + '">' + escapeHtml(ft.label) + '</span></strong>' +
    (showContext
      ? '<span class="muted small">Project: <b class="mono">' + escapeHtml(f.projectId) + '</b> &middot; ' + escapeHtml(f.contractorName || '') + ' &middot; ' + escapeHtml(f.category) + ' &middot; ' + formatDate(f.uploadDate) + '</span>'
      : '<span class="muted small">' + formatBytes(f.sizeBytes) + ' &middot; ' + formatDate(f.uploadDate) + ' &middot; ' + escapeHtml(f.uploadedBy || '') + '</span>') +
    '  </div>' +
    '  <button class="icon-btn" data-quickview-idx="' + idx + '" title="Quick View" aria-label="Quick view">' + icon('image') + '</button>' +
    '  <button class="icon-btn" data-download-id="' + escapeHtml(f.fileId) + '" data-download-name="' + escapeHtml(f.fileName) + '" title="Download" aria-label="Download">' + icon('download') + '</button>' +
    (canDelete ? '<button class="icon-btn" data-delete-id="' + escapeHtml(f.fileId) + '" title="Delete" aria-label="Delete file">' + icon('trash') + '</button>' : '') +
    '</div>'
  );
}

function wireGalleryLazyThumbs() {
  var tiles = document.querySelectorAll('.gallery-tile');
  if (!tiles.length) return;

  var pending = [];
  var flushTimer = null;

  function flush() {
    var batch = pending.splice(0, pending.length);
    if (!batch.length) return;
    var ids = batch.map(function (b) { return b.fileId; });
    Api.get('getFileContentBatch', { fileIds: ids.join(','), thumbnail: 'true' }).then(function (results) {
      var byId = {};
      results.forEach(function (r) { byId[r.fileId] = r; });
      batch.forEach(function (b) {
        var r = byId[b.fileId];
        var wrap = b.tile.querySelector('.gallery-tile__thumb-wrap');
        if (r && r.ok !== false && r.base64) {
          wrap.innerHTML = '<img class="gallery-tile__thumb" src="data:' + r.mimeType + ';base64,' + r.base64 + '" alt="' + escapeHtml(r.fileName || '') + '" loading="lazy">';
        }
      });
    }).catch(function () { /* ব্যাচ ব্যর্থ হলে placeholder icon-ই থাকবে, নীরবে বাদ দেওয়া হয় */ });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      pending.push({ fileId: entry.target.getAttribute('data-file-id'), tile: entry.target });
      clearTimeout(flushTimer);
      // ১২০ms এর মধ্যে একসাথে যতগুলো টাইল viewport-এ ঢোকে, সবগুলো এক ব্যাচে পাঠানো হয়
      flushTimer = setTimeout(flush, 120);
      if (pending.length >= 15) { clearTimeout(flushTimer); flush(); } // ১৫টা হলে সাথে সাথে পাঠাও
    });
  }, { rootMargin: '150px' });
  tiles.forEach(function (t) { observer.observe(t); });
}

/** গ্যালারি টাইল এবং doc-row-এর "Quick View" বাটন — দুটোই একই combined ফাইল-লিস্টের
 *  ভেতর Quick View মোডাল খোলে, যাতে Prev/Next দিয়ে পুরো result set-এর মধ্যে ব্রাউজ করা যায়। */
function wireQuickViewClicks(area, allFiles) {
  area.querySelectorAll('.gallery-tile').forEach(function (tile) {
    tile.addEventListener('click', function (e) {
      if (e.target.closest('.gallery-tile__delete')) return;
      openQuickView(allFiles, Number(tile.getAttribute('data-idx')));
    });
  });
  area.querySelectorAll('[data-quickview-idx]').forEach(function (btn) {
    btn.addEventListener('click', function () { openQuickView(allFiles, Number(btn.getAttribute('data-quickview-idx'))); });
  });
}

function wireDeleteButtons(area, onDeleted) {
  area.querySelectorAll('[data-delete-id]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('এই ফাইলটি মুছে ফেলতে চান?')) return;
      Api.post('deleteFile', { fileId: btn.getAttribute('data-delete-id') })
        .then(function () { Toast.success('ফাইল মুছে ফেলা হয়েছে'); refreshSearchIndex(); if (onDeleted) onDeleted(); })
        .catch(function (err) { Toast.error(err.message); });
    });
  });
}

function wireDownloadButtons(area) {
  area.querySelectorAll('[data-download-id]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var fileId = btn.getAttribute('data-download-id');
      var name = btn.getAttribute('data-download-name');
      btn.disabled = true;
      Api.get('getFileContent', { fileId: fileId }).then(function (res) {
        var link = document.createElement('a');
        link.href = 'data:' + res.mimeType + ';base64,' + res.base64;
        link.download = name;
        link.click();
      }).catch(function (err) { Toast.error(err.message); }).finally(function () { btn.disabled = false; });
    });
  });
}

/* --------------------------------- Quick View (image / PDF / doc) ----------------------------------- */

function openQuickView(items, idx) {
  var node = el(
    '<div class="lightbox" role="dialog" aria-modal="true" aria-label="File preview">' +
    '  <button class="icon-btn lightbox__close" aria-label="Close">' + icon('close') + '</button>' +
    '  <button class="icon-btn lightbox__prev" aria-label="Previous">' + icon('chevron') + '</button>' +
    '  <div class="lightbox__stage"><div class="spinner"></div></div>' +
    '  <button class="icon-btn lightbox__next" style="transform:scaleX(-1)" aria-label="Next">' + icon('chevron') + '</button>' +
    '  <div class="lightbox__caption"></div>' +
    '</div>'
  );
  document.body.appendChild(node);
  document.body.style.overflow = 'hidden';
  var lastTrigger = document.activeElement;

  function close() { node.remove(); document.body.style.overflow = ''; if (lastTrigger && lastTrigger.focus) lastTrigger.focus(); }

  function show(i) {
    idx = (i + items.length) % items.length;
    var f = items[idx];
    var stage = node.querySelector('.lightbox__stage');
    stage.innerHTML = '<div class="spinner"></div>';
    node.querySelector('.lightbox__caption').innerHTML =
      '<strong>' + escapeHtml(f.fileName) + '</strong>' +
      '<span class="mono">' + formatDate(f.uploadDate) + ' · ' + escapeHtml(f.contractorName || '') + ' · ' + escapeHtml(f.projectId || '') + (f.category ? ' · ' + escapeHtml(f.category) : '') + '</span>' +
      '<a class="btn btn--ghost btn--sm lightbox__dl" data-dl-id="' + escapeHtml(f.fileId) + '" data-dl-name="' + escapeHtml(f.fileName) + '">' + icon('download') + ' Download' + (f.isPdf ? ' PDF' : '') + '</a>';

    // অফিস ডকুমেন্ট (doc/docx/xls/xlsx) ব্রাউজারে সরাসরি প্রিভিউ করা সম্ভব না —
    // তাই সরাসরি "Preview not available, download করুন" দেখানো হয়, ফালতু নেটওয়ার্ক কল না করে।
    if (!f.isImage && !f.isPdf) {
      stage.innerHTML = '<div class="lightbox__nopreview">' + icon('doc') + '<p>Preview not available for this file type.</p><p class="muted small">ডাউনলোড করে দেখুন।</p></div>';
      wireLightboxDownload(node);
      return;
    }

    Api.get('getFileContent', { fileId: f.fileId }).then(function (res) {
      if (f.isPdf) {
        stage.innerHTML =
          '<iframe class="lightbox__pdf" src="data:application/pdf;base64,' + res.base64 + '" title="PDF preview"></iframe>' +
          '<p class="lightbox__pdf-hint muted small">PDF দেখা না গেলে উপরের Download বাটন ব্যবহার করুন।</p>';
      } else {
        stage.innerHTML = '<img class="lightbox__img" src="data:' + res.mimeType + ';base64,' + res.base64 + '" alt="' + escapeHtml(f.fileName) + '">';
        stage.querySelector('.lightbox__img').addEventListener('click', function (img) {
          return function () { img.classList.toggle('lightbox__img--zoomed'); };
        }(stage.querySelector('.lightbox__img')));
      }
      wireLightboxDownload(node);
    }).catch(function (err) {
      stage.innerHTML = '<div class="lightbox__nopreview">' + icon('doc') + '<p>' + escapeHtml(err.message) + '</p></div>';
    });
  }

  function wireLightboxDownload(scopeNode) {
    var dl = scopeNode.querySelector('.lightbox__dl');
    if (!dl) return;
    dl.addEventListener('click', function (e) {
      e.preventDefault();
      Api.get('getFileContent', { fileId: dl.getAttribute('data-dl-id') }).then(function (res) {
        var link = document.createElement('a');
        link.href = 'data:' + res.mimeType + ';base64,' + res.base64;
        link.download = dl.getAttribute('data-dl-name');
        link.click();
      }).catch(function (err) { Toast.error(err.message); });
    });
  }

  node.querySelector('.lightbox__close').addEventListener('click', close);
  node.querySelector('.lightbox__prev').addEventListener('click', function () { show(idx - 1); });
  node.querySelector('.lightbox__next').addEventListener('click', function () { show(idx + 1); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  show(idx);
}

/* ---------------------------------- Search ------------------------------------ */

function viewSearch(query) {
  mount(
    '<section class="section-head"><h1>' + icon('search') + ' Search Projects, Contractors &amp; Documents</h1></section>' +
    '<form id="search-form" class="search-hero">' +
    '  <label for="search-q" class="visually-hidden">Search</label>' +
    '  <input type="text" name="q" id="search-q" placeholder="Search Project ID, Contractor, Category or File Name..." value="' + escapeHtml(query || '') + '" autocomplete="off">' +
    '  <button type="submit" class="btn btn--primary">' + icon('search') + ' Search</button>' +
    '</form>' +
    '<div id="global-results"></div>' +
    renderAdvancedSearchPanelHtml() +
    '<div id="advanced-results"></div>'
  );

  document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = document.getElementById('search-q').value.trim();
    if (q) location.hash = '#/search/' + encodeURIComponent(q);
  });
  document.getElementById('search-q').addEventListener('input', debounce(function () {
    var q = document.getElementById('search-q').value.trim();
    if (q.length >= 2) { history.replaceState(null, '', '#/search/' + encodeURIComponent(q)); runGlobalSearch(q); }
    else document.getElementById('global-results').innerHTML = '';
  }, 350));

  wireAdvancedSearchPanel();

  if (query) runGlobalSearch(query);
}

function runGlobalSearch(query) {
  var box = document.getElementById('global-results');
  box.innerHTML = skeletonCards(3) + skeletonGallery(4);
  Api.get('globalSearch', { q: query }).then(function (res) {
    var total = res.projects.length + res.files.length;
    if (!total) {
      box.innerHTML = emptyStateHtml('No Results Found', 'We couldn\u2019t find any project or document matching "' + query + '". Try another Project ID, Contractor or Document Name.');
      return;
    }
    var canDelete = Auth.isAdminOrModerator();
    var html = '<p class="muted">' + total + ' result' + (total === 1 ? '' : 's') + ' found for "' + escapeHtml(query) + '"</p>';
    if (res.projects.length) {
      html += '<h3 class="results-subhead">Projects (' + res.projects.length + ')</h3><div class="project-grid">' + res.projects.map(searchProjectCard).join('') + '</div>';
    }
    if (res.files.length) {
      var images = res.files.filter(function (f) { return f.isImage; });
      var docs = res.files.filter(function (f) { return !f.isImage; });
      html += '<h3 class="results-subhead">Files (' + res.files.length + ')</h3>' +
        (images.length ? '<div class="gallery-grid">' + images.map(function (f) { return galleryTile(f, res.files.indexOf(f), canDelete, true); }).join('') + '</div>' : '') +
        (docs.length ? '<div class="doc-list">' + docs.map(function (f) { return docRow(f, res.files.indexOf(f), canDelete, true); }).join('') + '</div>' : '');
    }
    box.innerHTML = html;
    wireGalleryLazyThumbs();
    wireQuickViewClicks(box, res.files);
    wireDeleteButtons(box, function () { runGlobalSearch(query); });
    wireDownloadButtons(box);
  }).catch(function (err) { box.innerHTML = errorStateHtml(err.message); });
}

function searchProjectCard(p) {
  var statusCls = p.status === 'Archived' ? 'badge--muted' : 'badge--active';
  return (
    '<a class="project-badge" href="#/project/' + encodeURIComponent(p.projectId) + '">' +
    '  <span class="project-badge__id mono">' + escapeHtml(p.projectId) + '</span>' +
    '  <span class="project-badge__name">' + escapeHtml(p.projectName) + '</span>' +
    '  <span class="project-badge__meta">' + escapeHtml(p.contractorName) + ' · ' + p.fileCount + ' files</span>' +
    '  <span class="badge ' + statusCls + '"><span class="badge-dot"></span>' + escapeHtml(p.status) + '</span>' +
    '  <span class="project-badge__cta">Open Project ' + icon('chevron') + '</span>' +
    '</a>'
  );
}

/* ------------------------------ Advanced (multi-criteria) search --------------- */

function renderAdvancedSearchPanelHtml() {
  return (
    '<section class="adv-search">' +
    '  <h3 class="results-subhead">Advanced Search</h3>' +
    '  <div class="adv-search__grid">' +
    '    <div class="adv-field"><label>Contractor</label><select id="adv-contractor"><option value="">All Contractors</option></select></div>' +
    '    <div class="adv-field"><label>Project ID</label><div id="adv-project-select"></div></div>' +
    '    <div class="adv-field"><label>Category</label><select id="adv-category"><option value="">All Categories</option>' +
    window.APP_CONFIG.CATEGORIES.map(function (c) { return '<option value="' + escapeHtml(c.key) + '">' + escapeHtml(c.label) + '</option>'; }).join('') +
    '    </select></div>' +
    '    <div class="adv-field"><label>File Type</label><select id="adv-filetype"><option value="">All Types</option><option value="jpg">Image (JPG)</option><option value="png">Image (PNG)</option><option value="webp">Image (WEBP)</option><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="xlsx">XLSX</option></select></div>' +
    '    <div class="adv-field"><label>Date From</label><input type="date" id="adv-from"></div>' +
    '    <div class="adv-field"><label>Date To</label><input type="date" id="adv-to"></div>' +
    '  </div>' +
    '  <div class="btn-row"><button class="btn btn--primary btn--sm" id="adv-search-btn">' + icon('search') + ' SEARCH</button><button class="btn btn--ghost btn--sm" id="adv-reset-btn">' + icon('refresh') + ' RESET</button></div>' +
    '</section>'
  );
}

function wireAdvancedSearchPanel() {
  var contractorSel = document.getElementById('adv-contractor');
  var projectSelectContainer = document.getElementById('adv-project-select');
  var selectedProjectId = '';
  var projectCombo = mountSearchableSelect(projectSelectContainer, [], {
    placeholder: 'Any Project ID',
    onSelect: function (value) { selectedProjectId = value; },
    onClear: function () { selectedProjectId = ''; }
  });

  ensureSearchIndexLoaded().then(function () {
    contractorSel.innerHTML = '<option value="">All Contractors</option>' +
      State.allContractors.map(function (c) { return '<option value="' + escapeHtml(c.contractorId) + '">' + escapeHtml(c.contractorName) + '</option>'; }).join('');
    projectCombo.setOptions(projectOptionsFor(''));
  }).catch(function () { /* index লোড ব্যর্থ হলেও বাকি ফিল্টার কাজ করবে */ });

  function projectOptionsFor(contractorId) {
    var list = !contractorId ? State.allProjects : State.allProjects.filter(function (p) { return p.contractorId === contractorId; });
    return (list || []).map(function (p) { return { value: p.projectId, label: p.projectId, sublabel: p.projectName + ' · ' + p.contractorName }; });
  }

  contractorSel.addEventListener('change', function () {
    selectedProjectId = '';
    projectCombo.clear();
    projectCombo.setOptions(projectOptionsFor(contractorSel.value));
  });

  document.getElementById('adv-search-btn').addEventListener('click', function () {
    runAdvancedSearch({
      contractorId: contractorSel.value,
      projectId: selectedProjectId,
      category: document.getElementById('adv-category').value,
      fileType: document.getElementById('adv-filetype').value,
      dateFrom: document.getElementById('adv-from').value,
      dateTo: document.getElementById('adv-to').value
    });
  });
  document.getElementById('adv-reset-btn').addEventListener('click', function () {
    contractorSel.value = ''; selectedProjectId = ''; projectCombo.clear(); projectCombo.setOptions(projectOptionsFor(''));
    document.getElementById('adv-category').value = '';
    document.getElementById('adv-filetype').value = '';
    document.getElementById('adv-from').value = '';
    document.getElementById('adv-to').value = '';
    document.getElementById('advanced-results').innerHTML = '';
  });
}

function runAdvancedSearch(filters) {
  var box = document.getElementById('advanced-results');
  box.innerHTML = skeletonGallery(4);
  Api.get('listFiles', filters).then(function (files) {
    if (!files.length) { box.innerHTML = emptyStateHtml('No Results Found', 'Try different filters, or Reset and start again.'); return; }
    var canDelete = Auth.isAdminOrModerator();
    var images = files.filter(function (f) { return f.isImage; });
    var docs = files.filter(function (f) { return !f.isImage; });
    box.innerHTML = '<p class="muted">' + files.length + ' file(s) found</p>' +
      (images.length ? '<div class="gallery-grid">' + images.map(function (f) { return galleryTile(f, files.indexOf(f), canDelete, true); }).join('') + '</div>' : '') +
      (docs.length ? '<div class="doc-list">' + docs.map(function (f) { return docRow(f, files.indexOf(f), canDelete, true); }).join('') + '</div>' : '');
    wireGalleryLazyThumbs();
    wireQuickViewClicks(box, files);
    wireDeleteButtons(box, function () { runAdvancedSearch(filters); });
    wireDownloadButtons(box);
  }).catch(function (err) { box.innerHTML = errorStateHtml(err.message); });
}

/* ---------------------------------- Admin -------------------------------------- */

var ADMIN_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'gear' },
  { key: 'contractors', label: 'Contractors', icon: 'users' },
  { key: 'projects', label: 'Projects', icon: 'doc' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'audit-log', label: 'Audit Log', icon: 'log' },
  { key: 'trash', label: 'Trash', icon: 'trash' },
  { key: 'settings', label: 'Settings', icon: 'gear' }
];

function viewAdmin(tab) {
  if (!Auth.isAdminOrModerator()) { mount(emptyStateHtml('অনুমতি নেই', 'এই পাতা দেখার অনুমতি আপনার নেই। Admin হিসেবে সাইন-ইন করুন।')); return; }
  mount(
    '<section class="section-head"><h1>Admin Dashboard</h1></section>' +
    '<div class="admin-tabs" role="tablist">' + ADMIN_TABS.map(function (t) {
      return '<a class="tab-btn' + (t.key === tab ? ' tab-btn--active' : '') + '" href="#/admin/' + t.key + '" role="tab" aria-selected="' + (t.key === tab) + '">' + icon(t.icon) + '<span>' + t.label + '</span></a>';
    }).join('') + '</div>' +
    '<div id="admin-content">' + skeletonTable(6, 5) + '</div>'
  );
  var renderers = {
    dashboard: adminDashboardTab, contractors: adminContractorsTab, projects: adminProjectsTab,
    users: adminUsersTab, 'audit-log': adminAuditLogTab, trash: adminTrashTab, settings: adminSettingsTab
  };
  (renderers[tab] || adminDashboardTab)();
}

function adminDashboardTab() {
  var box = document.getElementById('admin-content');
  Api.get('dashboardStats', {}).then(function (s) {
    box.innerHTML =
      '<section class="stat-strip">' +
      statCard('building', s.totalContractors, 'Contractors', 'var(--engineering-blue)') + statCard('doc', s.totalProjects, 'Projects', 'var(--navy)') +
      statCard('camera', s.totalPhotos, 'Photos', 'var(--accent)') + statCard('doc', s.totalDocuments, 'Documents', 'var(--engineering-blue)') + statCard('upload', s.todaysUploads, "Today's Uploads", 'var(--warning)') +
      '</section>' +
      (s.contractorStats && s.contractorStats.length ? '<section class="chart-row"><div class="chart-panel"><h3>' + icon('building') + ' Projects by Contractor</h3>' + renderBarChartHtml(s.contractorStats.map(function (c) { return { label: c.contractorName, value: c.projects, colorVar: 'var(--navy)' }; })) + '</div>' +
        '<div class="chart-panel"><h3>' + icon('camera') + ' Photos by Contractor</h3>' + renderBarChartHtml(s.contractorStats.map(function (c) { return { label: c.contractorName, value: c.photos, colorVar: 'var(--accent)' }; })) + '</div></section>' : '') +
      '<div class="table-scroll" style="margin-top:20px"><table class="data-table"><thead><tr><th>Contractor</th><th>Projects</th><th>Photos</th><th>Documents</th></tr></thead><tbody>' +
      s.contractorStats.map(function (c) { return '<tr><td>' + escapeHtml(c.contractorName) + '</td><td>' + c.projects + '</td><td>' + c.photos + '</td><td>' + c.documents + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    box.querySelectorAll('.stat-card__value').forEach(function (v) { animateCount(v, v.getAttribute('data-target')); });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function adminContractorsTab() {
  var box = document.getElementById('admin-content');
  Api.get('listContractors', {}).then(function (list) {
    box.innerHTML =
      '<div class="section-head"><h2></h2><button class="btn btn--primary btn--sm" id="add-c-btn">' + icon('plus') + ' Add Contractor</button></div>' +
      '<input type="text" class="table-search" id="c-search" placeholder="Search contractors...">' +
      '<div class="table-scroll"><table class="data-table" id="c-table"><thead><tr><th data-sort-key="contractorId">ID</th><th data-sort-key="contractorName">Name</th><th data-sort-key="projectCount">Projects</th><th data-sort-key="fileCount">Files</th><th data-sort-key="status">Status</th><th></th></tr></thead><tbody></tbody></table></div>';
    document.getElementById('add-c-btn').addEventListener('click', openAddContractorModal);
    var table = document.getElementById('c-table'), tbody = table.querySelector('tbody');
    tbody.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-toggle-c]');
      if (!btn) return;
      Api.post('setContractorStatus', { contractorId: btn.getAttribute('data-toggle-c'), status: btn.getAttribute('data-status') })
        .then(function () { refreshSearchIndex(); adminContractorsTab(); }).catch(function (err) { Toast.error(err.message); });
    });
    attachTableControls({
      table: table, tbody: tbody, searchInput: document.getElementById('c-search'), rows: list, searchFields: ['contractorId', 'contractorName'],
      renderRow: function (c) {
        return '<tr><td class="mono">' + escapeHtml(c.contractorId) + '</td><td>' + escapeHtml(c.contractorName) + '</td><td>' + c.projectCount + '</td><td>' + c.fileCount + '</td>' +
          '<td><span class="badge ' + (c.status === 'Disabled' ? 'badge--muted' : 'badge--active') + '"><span class="badge-dot"></span>' + escapeHtml(c.status) + '</span></td>' +
          '<td><button class="btn btn--ghost btn--sm" data-toggle-c="' + escapeHtml(c.contractorId) + '" data-status="' + (c.status === 'Disabled' ? 'Active' : 'Disabled') + '">' + (c.status === 'Disabled' ? 'Enable' : 'Disable') + '</button></td></tr>';
      }
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function openAddContractorModal() {
  var node = el(
    '<div class="modal modal--sm"><div class="modal__head"><h3>Add Contractor</h3><button class="icon-btn modal-close" aria-label="Close">' + icon('close') + '</button></div>' +
    '<div class="modal__body"><form id="add-c-form"><label>Contractor Name<input type="text" name="contractorName" required></label>' +
    '<button type="submit" class="btn btn--primary btn--block">Add</button></form></div></div>'
  );
  Modal.open(node);
  node.querySelector('#add-c-form').addEventListener('submit', function (e) {
    e.preventDefault();
    Api.post('addContractor', { contractorName: e.target.contractorName.value.trim() })
      .then(function () { Modal.close(); Toast.success('Contractor যোগ হয়েছে'); refreshSearchIndex(); router(); })
      .catch(function (err) { Toast.error(err.message); });
  });
}

function adminProjectsTab() {
  var box = document.getElementById('admin-content');
  Promise.all([Api.get('listProjects', {}), Api.get('listContractors', {})]).then(function (res) {
    var projects = res[0], contractors = res[1];
    var byId = {}; contractors.forEach(function (c) { byId[c.contractorId] = c.contractorName; });
    projects.forEach(function (p) { p._contractorName = byId[p.contractorId] || p.contractorId; });
    box.innerHTML =
      '<div class="section-head"><h2></h2><button class="btn btn--primary btn--sm" id="add-p-btn">' + icon('plus') + ' New System</button></div>' +
      '<input type="text" class="table-search" id="p-search" placeholder="Search projects...">' +
      '<div class="table-scroll"><table class="data-table" id="p-table"><thead><tr><th data-sort-key="projectId">Project ID</th><th data-sort-key="_contractorName">Contractor</th><th data-sort-key="projectName">Name</th><th data-sort-key="fileCount">Files</th><th data-sort-key="status">Status</th><th></th></tr></thead><tbody></tbody></table></div>';
    document.getElementById('add-p-btn').addEventListener('click', function () { openNewSystemModal(''); });
    var table = document.getElementById('p-table'), tbody = table.querySelector('tbody');
    tbody.addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-edit-p]');
      if (editBtn) { openEditProjectModal(editBtn.getAttribute('data-edit-p'), editBtn.getAttribute('data-name')); return; }
      var archBtn = e.target.closest('[data-archive-p]');
      if (archBtn) {
        Api.post('archiveProject', { projectId: archBtn.getAttribute('data-archive-p'), status: archBtn.getAttribute('data-status') })
          .then(function () { refreshSearchIndex(); adminProjectsTab(); }).catch(function (err) { Toast.error(err.message); });
      }
    });
    attachTableControls({
      table: table, tbody: tbody, searchInput: document.getElementById('p-search'), rows: projects, searchFields: ['projectId', 'projectName', '_contractorName'],
      renderRow: function (p) {
        return '<tr><td class="mono"><a href="#/project/' + encodeURIComponent(p.projectId) + '">' + escapeHtml(p.projectId) + '</a></td>' +
          '<td>' + escapeHtml(p._contractorName) + '</td><td>' + escapeHtml(p.projectName) + '</td><td>' + p.fileCount + '</td>' +
          '<td><span class="badge ' + (p.status === 'Archived' ? 'badge--muted' : 'badge--active') + '"><span class="badge-dot"></span>' + escapeHtml(p.status) + '</span></td>' +
          '<td class="btn-row"><button class="icon-btn" data-edit-p="' + escapeHtml(p.projectId) + '" data-name="' + escapeHtml(p.projectName) + '" title="Edit" aria-label="Edit">' + icon('edit') + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-archive-p="' + escapeHtml(p.projectId) + '" data-status="' + (p.status === 'Archived' ? 'Active' : 'Archived') + '">' + (p.status === 'Archived' ? 'Unarchive' : 'Archive') + '</button></td></tr>';
      }
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function roleDisplayLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'moderator') return '<span class="badge badge--active">Moderator</span>';
  if (role === 'contractor') return 'Contractor';
  return escapeHtml(role);
}

function adminUsersTab() {
  var box = document.getElementById('admin-content');
  Api.get('listUsers', {}).then(function (users) {
    box.innerHTML =
      '<div class="section-head"><h2></h2><button class="btn btn--primary btn--sm" id="add-u-btn">' + icon('plus') + ' Add User</button></div>' +
      '<input type="text" class="table-search" id="u-search" placeholder="Search users...">' +
      '<div class="table-scroll"><table class="data-table" id="u-table"><thead><tr><th data-sort-key="email">Email</th><th data-sort-key="role">Role</th><th data-sort-key="contractorName">Contractor</th><th data-sort-key="status">Status</th><th></th></tr></thead><tbody></tbody></table></div>';
    document.getElementById('add-u-btn').addEventListener('click', function () { openAddUserModal(); });
    var table = document.getElementById('u-table'), tbody = table.querySelector('tbody');
    tbody.addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-edit-u]');
      if (editBtn) { openEditUserModal(editBtn.getAttribute('data-edit-u'), editBtn.getAttribute('data-role'), editBtn.getAttribute('data-cid')); return; }
      var toggleBtn = e.target.closest('[data-toggle-u]');
      if (toggleBtn) {
        Api.post('setUserStatus', { email: toggleBtn.getAttribute('data-toggle-u'), status: toggleBtn.getAttribute('data-status') })
          .then(function () { adminUsersTab(); }).catch(function (err) { Toast.error(err.message); });
      }
    });
    attachTableControls({
      table: table, tbody: tbody, searchInput: document.getElementById('u-search'), rows: users, searchFields: ['email', 'role', 'contractorName'],
      renderRow: function (u) {
        return '<tr><td>' + escapeHtml(u.email) + '</td><td>' + roleDisplayLabel(u.role) + '</td><td>' + escapeHtml(u.contractorName) + '</td>' +
          '<td><span class="badge ' + (u.status === 'Disabled' ? 'badge--muted' : 'badge--active') + '"><span class="badge-dot"></span>' + escapeHtml(u.status) + '</span></td>' +
          '<td class="btn-row"><button class="icon-btn" data-edit-u="' + escapeHtml(u.email) + '" data-role="' + escapeHtml(u.role) + '" data-cid="' + escapeHtml(u.contractorId) + '" title="Edit" aria-label="Edit">' + icon('edit') + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-toggle-u="' + escapeHtml(u.email) + '" data-status="' + (u.status === 'Disabled' ? 'Active' : 'Disabled') + '">' + (u.status === 'Disabled' ? 'Enable' : 'Disable') + '</button></td></tr>';
      }
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function openAddUserModal() {
  Api.get('listContractors', {}).then(function (contractors) {
    var node = el(
      '<div class="modal modal--sm"><div class="modal__head"><h3>Add User</h3><button class="icon-btn modal-close" aria-label="Close">' + icon('close') + '</button></div>' +
      '<div class="modal__body"><form id="add-u-form">' +
      '<label>Email (Google account)<input type="email" name="email" required></label>' +
      '<label>Role<select name="role" id="u-role"><option value="contractor">Contractor</option><option value="moderator">Moderator (Full Access)</option><option value="admin">Admin</option></select></label>' +
      '<label id="u-contractor-wrap">Contractor<select name="contractorId">' + contractors.map(function (c) { return '<option value="' + escapeHtml(c.contractorId) + '">' + escapeHtml(c.contractorName) + '</option>'; }).join('') + '</select></label>' +
      '<button type="submit" class="btn btn--primary btn--block">Add User</button></form></div></div>'
    );
    Modal.open(node);
    var roleSel = node.querySelector('#u-role'), cWrap = node.querySelector('#u-contractor-wrap');
    roleSel.addEventListener('change', function () { cWrap.style.display = roleSel.value === 'contractor' ? '' : 'none'; });
    node.querySelector('#add-u-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      Api.post('addUser', { email: f.email.value.trim(), role: f.role.value, contractorId: f.role.value === 'contractor' ? f.contractorId.value : '' })
        .then(function () { Modal.close(); Toast.success('User যোগ হয়েছে'); adminUsersTab(); })
        .catch(function (err) { Toast.error(err.message); });
    });
  });
}

function openEditUserModal(email, currentRole, currentContractorId) {
  Api.get('listContractors', {}).then(function (contractors) {
    var node = el(
      '<div class="modal modal--sm"><div class="modal__head"><h3>Edit User</h3><button class="icon-btn modal-close" aria-label="Close">' + icon('close') + '</button></div>' +
      '<div class="modal__body"><form id="edit-u-form">' +
      '<label>Email<input type="email" value="' + escapeHtml(email) + '" disabled></label>' +
      '<label>Role<select name="role" id="eu-role"><option value="contractor"' + (currentRole === 'contractor' ? ' selected' : '') + '>Contractor</option><option value="moderator"' + (currentRole === 'moderator' ? ' selected' : '') + '>Moderator (Full Access)</option><option value="admin"' + (currentRole === 'admin' ? ' selected' : '') + '>Admin</option></select></label>' +
      '<label id="eu-contractor-wrap" style="display:' + (currentRole === 'contractor' ? '' : 'none') + '">Contractor<select name="contractorId">' +
      contractors.map(function (c) { return '<option value="' + escapeHtml(c.contractorId) + '"' + (c.contractorId === currentContractorId ? ' selected' : '') + '>' + escapeHtml(c.contractorName) + '</option>'; }).join('') +
      '</select></label>' +
      '<button type="submit" class="btn btn--primary btn--block">Save</button></form></div></div>'
    );
    Modal.open(node);
    var roleSel = node.querySelector('#eu-role'), cWrap = node.querySelector('#eu-contractor-wrap');
    roleSel.addEventListener('change', function () { cWrap.style.display = roleSel.value === 'contractor' ? '' : 'none'; });
    node.querySelector('#edit-u-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      Api.post('editUser', { email: email, role: f.role.value, contractorId: f.role.value === 'contractor' ? f.contractorId.value : '' })
        .then(function () { Modal.close(); Toast.success('User আপডেট হয়েছে'); adminUsersTab(); })
        .catch(function (err) { Toast.error(err.message); });
    });
  });
}

function adminAuditLogTab() {
  var box = document.getElementById('admin-content');
  box.innerHTML =
    '<div class="toolbar"><input type="text" id="a-user" placeholder="User email"><input type="text" id="a-project" placeholder="Project ID">' +
    '<select id="a-action"><option value="">All actions</option><option>UPLOADED</option><option>DELETED</option><option>RESTORED</option><option>CREATE_PROJECT</option><option>ADD_CONTRACTOR</option><option>ADD_USER</option><option>ARCHIVE_PROJECT</option></select>' +
    '<input type="date" id="a-from" title="From date">' +
    '<button class="btn btn--ghost btn--sm" id="a-refresh" aria-label="Refresh">' + icon('refresh') + '</button></div>' +
    '<div id="audit-table" class="chart-panel"></div>';

  function load() {
    var params = { userFilter: document.getElementById('a-user').value, projectId: document.getElementById('a-project').value, action: document.getElementById('a-action').value, dateFrom: document.getElementById('a-from').value, limit: 300 };
    var table = document.getElementById('audit-table');
    table.innerHTML = loadingHtml();
    Api.get('listAuditLog', params).then(function (rows) {
      if (!rows.length) { table.innerHTML = '<div class="empty-state"><p>কোনো লগ পাওয়া যায়নি।</p></div>'; return; }
      table.innerHTML = renderActivityTimeline(rows, false);
    }).catch(function (err) { table.innerHTML = errorHtml(err.message); });
  }
  document.getElementById('a-refresh').addEventListener('click', load);
  ['a-user', 'a-project'].forEach(function (id) { document.getElementById(id).addEventListener('input', debounce(load, 400)); });
  document.getElementById('a-action').addEventListener('change', load);
  document.getElementById('a-from').addEventListener('change', load);
  load();
}

function adminTrashTab() {
  var box = document.getElementById('admin-content');
  box.innerHTML = '<p class="muted small" style="margin-bottom:12px">মুছে ফেলা ফাইলগুলো এখানে দেখা যায় — Restore করলে সেগুলো আবার প্রজেক্টের গ্যালারিতে ফিরে আসবে।</p><div id="trash-list">' + skeletonTable(4, 3) + '</div>';
  var list = document.getElementById('trash-list');
  Api.get('listFiles', { trashOnly: 'true' }).then(function (files) {
    if (!files.length) { list.innerHTML = '<div class="empty-state"><p>Trash খালি।</p></div>'; return; }
    list.innerHTML = '<div class="doc-list">' + files.map(function (f) {
      return '<div class="doc-row"><span class="mono small muted">' + escapeHtml(f.projectId) + '</span>' +
        '<div class="doc-row__info"><strong>' + escapeHtml(f.fileName) + '</strong><span class="muted small">' + escapeHtml(f.category) + ' &middot; ' + formatDate(f.uploadDate) + '</span></div>' +
        '<button class="btn btn--ghost btn--sm" data-restore-id="' + escapeHtml(f.fileId) + '">' + icon('refresh') + ' Restore</button></div>';
    }).join('') + '</div>';
    list.querySelectorAll('[data-restore-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Api.post('restoreFile', { fileId: btn.getAttribute('data-restore-id') })
          .then(function () { Toast.success('ফাইল পুনরুদ্ধার করা হয়েছে'); refreshSearchIndex(); adminTrashTab(); })
          .catch(function (err) { Toast.error(err.message); });
      });
    });
  }).catch(function (err) { list.innerHTML = errorHtml(err.message); });
}

function adminSettingsTab() {
  var box = document.getElementById('admin-content');
  Api.get('getUploadRules', {}).then(function (rules) {
    box.innerHTML =
      '<form id="rules-form" class="settings-form">' +
      '  <label>Allowed extensions (comma separated)<input type="text" name="ext" value="' + escapeHtml(rules.allowedExtensions.join(', ')) + '"></label>' +
      '  <label>Max file size (MB)<input type="number" name="maxMb" value="' + Math.round(rules.maxFileSizeBytes / (1024 * 1024)) + '" min="1"></label>' +
      '  <button type="submit" class="btn btn--primary btn--sm">Save Settings</button>' +
      '</form>';
    document.getElementById('rules-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var exts = f.ext.value.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      Api.post('setUploadRules', { allowedExtensions: exts, maxFileSizeBytes: Number(f.maxMb.value) * 1024 * 1024 })
        .then(function () { Toast.success('Settings সংরক্ষিত হয়েছে'); })
        .catch(function (err) { Toast.error(err.message); });
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

/* ---------------------------------- Bootstrap ---------------------------------- */

window.onSessionExpired = function () {
  renderShell();
  Toast.error('আপনার সেশনের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে আবার সাইন-ইন করুন।');
  openLoginModal();
};

Theme.init();

window.addEventListener('DOMContentLoaded', function () {
  renderShell();
  router();
  ensureSearchIndexLoaded().catch(function () { /* প্রথম চেষ্টা ব্যর্থ হলে wireHeaderSuggestions আবার চেষ্টা করবে */ });
});
window.addEventListener('hashchange', router);
document.addEventListener('keydown', function (e) {
  var k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); openCommandPalette(); }
});

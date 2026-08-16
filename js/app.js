/**
 * app.js — Router + সব view render logic (Single Page Application)
 *
 * ডিজাইন সিদ্ধান্ত: স্পেসিফিকেশনে ১৩টি আলাদা .html পেজের কথা বলা হয়েছিল, কিন্তু
 * এখানে ইচ্ছাকৃতভাবে একটি SPA (index.html + hash router) হিসেবে বানানো হয়েছে —
 * একই ফাংশনালিটি বজায় থাকছে (প্রতিটি route নিচে আলাদা view হিসেবে আছে), শুধু
 * maintenance সহজ ও পেজ-লোড দ্রুত করার জন্য। প্রয়োজন হলে যেকোনো view সহজেই
 * আলাদা .html ফাইলে ভাঙা যাবে।
 */

var State = { projectCache: {} };

/* ---------------------------- App shell / header --------------------------- */

function renderShell() {
  var user = Auth.getUser();
  var shell = document.getElementById('shell');
  shell.innerHTML =
    '<header class="topbar">' +
    '  <div class="topbar__inner">' +
    '    <a href="#/" class="brand"><span class="brand__mark">CDP</span><span class="brand__name">' + escapeHtml(window.APP_CONFIG.APP_NAME) + '</span></a>' +
    '    <form id="global-search" class="topbar__search">' +
    '      <input type="text" name="q" placeholder="Contractor, Project ID, file name...">' +
    '      <button type="submit" aria-label="Search">' + icon('search') + '</button>' +
    '    </form>' +
    '    <nav class="topbar__nav">' +
    (user.role === 'admin' ? '<a href="#/admin/dashboard" class="navlink">' + icon('gear') + '<span>Admin</span></a>' : '') +
    (user.role === 'contractor' ? '<a href="#/contractor/' + encodeURIComponent(user.contractorId) + '" class="navlink">' + icon('doc') + '<span>My Projects</span></a>' : '') +
    '      <div id="user-slot"></div>' +
    '    </nav>' +
    '  </div>' +
    '</header>' +
    '<main id="view" class="view"></main>' +
    '<div id="modal-root"></div>';

  document.getElementById('global-search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = e.target.q.value.trim();
    if (q) location.hash = '#/search/' + encodeURIComponent(q);
  });

  renderUserSlot();
}

function renderUserSlot() {
  var user = Auth.getUser();
  var slot = document.getElementById('user-slot');
  if (user.role === 'public') {
    slot.innerHTML = '<button class="btn btn--primary btn--sm" id="login-btn">Sign in</button>';
    document.getElementById('login-btn').addEventListener('click', openLoginModal);
  } else {
    var roleLabel = user.role === 'admin' ? 'Admin' : ('Contractor · ' + escapeHtml(user.contractorName || ''));
    slot.innerHTML =
      '<div class="user-badge">' +
      '  <img src="' + (user.picture || '') + '" class="user-avatar" onerror="this.style.display=\'none\'">' +
      '  <div class="user-badge__text"><strong>' + escapeHtml(user.name) + '</strong><small>' + roleLabel + '</small></div>' +
      '  <button class="icon-btn" id="logout-btn" title="Sign out">' + icon('logout') + '</button>' +
      '</div>';
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);
  }
}

function openLoginModal() {
  var node = el(
    '<div class="modal modal--sm">' +
    '  <div class="modal__head"><h3>Sign in</h3><button class="icon-btn modal-close">' + icon('close') + '</button></div>' +
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
  function open(node) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '';
    var backdrop = el('<div class="modal-backdrop"></div>');
    backdrop.appendChild(node);
    root.appendChild(backdrop);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    var closeBtn = node.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
  }
  function close() { document.getElementById('modal-root').innerHTML = ''; }
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

function errorHtml(message) {
  return '<div class="empty-state empty-state--error"><p>' + escapeHtml(message) + '</p><button class="btn btn--ghost" onclick="router()">' + icon('refresh') + ' আবার চেষ্টা করুন</button></div>';
}

/* ---------------------------------- Home ------------------------------------ */

function viewHome() {
  mount(loadingHtml('ড্যাশবোর্ড লোড হচ্ছে...'));
  Promise.all([Api.get('dashboardStats', {}), Api.get('listContractors', {})])
    .then(function (res) {
      var stats = res[0], contractors = res[1];
      var user = Auth.getUser();
      mount(
        '<section class="hero">' +
        '  <p class="eyebrow">SITE DOCUMENTATION SYSTEM</p>' +
        '  <h1>Construction Photo &amp; Document Portal</h1>' +
        '  <p class="hero__sub">প্রতিটি ঠিকাদার প্রতিষ্ঠানের প্রজেক্ট-ভিত্তিক ছবি ও ডকুমেন্ট এক জায়গায়।</p>' +
        '</section>' +
        '<section class="stat-strip">' +
        statCard(stats.totalContractors, 'Contractors') +
        statCard(stats.totalProjects, 'Projects') +
        statCard(stats.totalPhotos, 'Photos') +
        statCard(stats.totalDocuments, 'Documents') +
        statCard(stats.todaysUploads, "Today's Uploads") +
        '</section>' +
        '<section class="section-head">' +
        '  <h2>Contractors</h2>' +
        (user.role === 'admin' ? '<button class="btn btn--primary btn--sm" id="add-contractor-btn">' + icon('plus') + ' New Contractor</button>' : '') +
        '</section>' +
        '<section class="contractor-grid">' +
        contractors.map(plateCard).join('') +
        '</section>'
      );
      if (user.role === 'admin') {
        document.getElementById('add-contractor-btn').addEventListener('click', openAddContractorModal);
      }
    })
    .catch(function (err) { mount(errorHtml(err.message)); });
}

function statCard(value, label) {
  return '<div class="stat-card"><div class="stat-card__value">' + escapeHtml(value) + '</div><div class="stat-card__label">' + escapeHtml(label) + '</div></div>';
}

function plateCard(c) {
  var statusCls = c.status === 'Disabled' ? 'badge--muted' : 'badge--active';
  return (
    '<a class="plate-card" href="#/contractor/' + encodeURIComponent(c.contractorId) + '">' +
    '  <div class="plate-card__rivet plate-card__rivet--tl"></div><div class="plate-card__rivet plate-card__rivet--tr"></div>' +
    '  <div class="plate-card__rivet plate-card__rivet--bl"></div><div class="plate-card__rivet plate-card__rivet--br"></div>' +
    '  <span class="plate-card__code">' + escapeHtml(c.contractorId) + '</span>' +
    '  <h3 class="plate-card__name">' + escapeHtml(c.contractorName) + '</h3>' +
    '  <div class="plate-card__stats"><span>' + c.projectCount + ' projects</span><span>' + c.fileCount + ' files</span></div>' +
    '  <span class="badge ' + statusCls + '">' + escapeHtml(c.status) + '</span>' +
    '</a>'
  );
}

function breadcrumb(items) {
  return '<nav class="breadcrumb">' + items.map(function (it, i) {
    var sep = i < items.length - 1 ? '<span class="breadcrumb__sep">/</span>' : '';
    return (it.href ? '<a href="' + it.href + '">' + escapeHtml(it.label) + '</a>' : '<span>' + escapeHtml(it.label) + '</span>') + sep;
  }).join('') + '</nav>';
}

/* ------------------------------ Contractor ----------------------------------- */

function viewContractor(contractorId) {
  mount(loadingHtml());
  Promise.all([Api.get('listContractors', {}), Api.get('listProjects', { contractorId: contractorId })])
    .then(function (res) {
      var contractor = res[0].filter(function (c) { return c.contractorId === contractorId; })[0];
      var projects = res[1];
      var user = Auth.getUser();
      if (!contractor) { mount(errorHtml('Contractor পাওয়া যায়নি')); return; }

      var isMine = user.role === 'contractor' && user.contractorId === contractorId;

      mount(
        breadcrumb([{ label: 'Home', href: '#/' }, { label: contractor.contractorName }]) +
        '<section class="section-head">' +
        '  <h1>' + (isMine ? 'My Projects — ' : '') + escapeHtml(contractor.contractorName) + ' <span class="mono muted">(' + escapeHtml(contractor.contractorId) + ')</span></h1>' +
        (user.role === 'admin' ? '<button class="btn btn--primary btn--sm" id="new-system-btn">' + icon('plus') + ' New System</button>' : '') +
        '</section>' +
        (projects.length === 0
          ? '<div class="empty-state"><p>এখনো কোনো প্রজেক্ট তৈরি হয়নি।</p></div>'
          : '<section class="project-grid">' + projects.map(projectBadge).join('') + '</section>')
      );

      if (user.role === 'admin') {
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
    '  <span class="project-badge__meta">' + p.fileCount + ' files</span>' +
    '  <span class="badge ' + statusCls + '">' + escapeHtml(p.status) + '</span>' +
    '</a>'
  );
}

function openNewSystemModal(defaultContractorId) {
  Api.get('listContractors', {}).then(function (contractors) {
    var node = el(
      '<div class="modal">' +
      '  <div class="modal__head"><h3>' + icon('plus') + ' New System</h3><button class="icon-btn modal-close">' + icon('close') + '</button></div>' +
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
    '<div class="modal modal--sm"><div class="modal__head"><h3>Edit Project</h3><button class="icon-btn modal-close">' + icon('close') + '</button></div>' +
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
        router();
      })
      .catch(function (err) { Toast.error(err.message); });
  });
}

/* -------------------------------- Project ------------------------------------ */

function viewProject(projectId) {
  mount(loadingHtml());
  Promise.all([Api.get('listProjects', {}), Api.get('listFiles', { projectId: projectId })])
    .then(function (res) {
      var project = res[0].filter(function (p) { return p.projectId === projectId; })[0];
      var files = res[1];
      if (!project) { mount(errorHtml('Project পাওয়া যায়নি')); return; }
      State.projectCache[projectId] = project;

      var user = Auth.getUser();
      var canManage = user.role === 'admin';
      var counts = {};
      window.APP_CONFIG.CATEGORIES.forEach(function (c) { counts[c.key] = 0; });
      files.forEach(function (f) { if (counts[f.category] !== undefined) counts[f.category]++; });

      mount(
        breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Contractor', href: '#/contractor/' + encodeURIComponent(project.contractorId) }, { label: project.projectId }]) +
        '<section class="section-head">' +
        '  <h1 class="mono">' + escapeHtml(project.projectId) + '<span class="muted"> — ' + escapeHtml(project.projectName) + '</span></h1>' +
        '  <div class="btn-row">' +
        '    <span class="badge ' + (project.status === 'Archived' ? 'badge--muted' : 'badge--active') + '">' + escapeHtml(project.status) + '</span>' +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="edit-project-btn">' + icon('edit') + ' Edit name</button>' : '') +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="repair-btn">' + icon('refresh') + ' Repair folders</button>' : '') +
        (canManage ? '<button class="btn btn--ghost btn--sm" id="archive-btn">' + (project.status === 'Archived' ? 'Unarchive' : 'Archive') + '</button>' : '') +
        '  </div>' +
        '</section>' +
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
            .then(function () { Toast.success('Status আপডেট হয়েছে'); router(); })
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
  return Api.get('listProjects', {}).then(function (all) {
    var p = all.filter(function (x) { return x.projectId === projectId; })[0];
    if (p) State.projectCache[projectId] = p;
    return p;
  });
}

function renderCategoryShell(project, category, filters) {
  var user = Auth.getUser();
  var canUpload = user.role === 'admin' || (user.role === 'contractor' && user.contractorId === project.contractorId);
  var canDelete = user.role === 'admin';

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
    '  <button class="btn btn--ghost btn--sm" id="f-refresh">' + icon('refresh') + '</button>' +
    '</section>' +
    '<div id="file-area">' + loadingHtml('ফাইল লোড হচ্ছে...') + '</div>'
  );

  if (canUpload) wireUploadDropzone(project.projectId, category);

  function applyFilters() {
    var f = {
      projectId: project.projectId, category: category,
      search: document.getElementById('f-search').value,
      fileType: document.getElementById('f-type').value,
      dateFrom: document.getElementById('f-from').value,
      dateTo: document.getElementById('f-to').value
    };
    loadFileArea(f, canDelete);
  }
  document.getElementById('f-refresh').addEventListener('click', applyFilters);
  document.getElementById('f-search').addEventListener('input', debounce(applyFilters, 400));
  ['f-type', 'f-from', 'f-to'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', applyFilters);
  });
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
    var row = el('<div class="upload-item"><span class="upload-item__name">' + escapeHtml(file.name) + '</span><span class="upload-item__status">⏳ Uploading...</span></div>');
    list.appendChild(row);
    fileToBase64(file).then(function (base64) {
      return Api.post('uploadFile', {
        projectId: projectId, category: category, fileName: file.name, mimeType: file.type || 'application/octet-stream', fileData: base64
      });
    }).then(function () {
      row.querySelector('.upload-item__status').innerHTML = '✅ Uploaded';
      row.classList.add('upload-item--ok');
      refreshFileAreaIfPresent(projectId, category);
    }).catch(function (err) {
      row.querySelector('.upload-item__status').innerHTML = '❌ ' + escapeHtml(err.message);
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
  area.innerHTML = loadingHtml('ফাইল লোড হচ্ছে...');
  Api.get('listFiles', filters).then(function (files) {
    if (files.length === 0) { area.innerHTML = '<div class="empty-state"><p>কোনো ফাইল পাওয়া যায়নি।</p></div>'; return; }
    var images = files.filter(function (f) { return f.isImage; });
    var docs = files.filter(function (f) { return !f.isImage; });

    area.innerHTML =
      (images.length ? '<div class="gallery-grid">' + images.map(function (f, i) { return galleryTile(f, i, canDelete); }).join('') + '</div>' : '') +
      (docs.length ? '<div class="doc-list">' + docs.map(function (f) { return docRow(f, canDelete); }).join('') + '</div>' : '');

    wireGalleryLazyThumbs(images);
    wireGalleryClicks(images);
    wireDeleteButtons(area, filters);
    wireDownloadButtons(area);
  }).catch(function (err) { area.innerHTML = errorHtml(err.message); });
}

function galleryTile(f, idx, canDelete) {
  return (
    '<figure class="gallery-tile" data-file-id="' + escapeHtml(f.fileId) + '" data-idx="' + idx + '">' +
    '  <div class="gallery-tile__thumb-wrap">' + icon('image', 'gallery-tile__placeholder') + '</div>' +
    '  <figcaption>' +
    '    <span class="gallery-tile__name">' + escapeHtml(f.fileName) + '</span>' +
    '    <span class="gallery-tile__date mono">' + formatDate(f.uploadDate) + '</span>' +
    '  </figcaption>' +
    (canDelete ? '<button class="icon-btn gallery-tile__delete" data-delete-id="' + escapeHtml(f.fileId) + '" title="Delete">' + icon('trash') + '</button>' : '') +
    '</figure>'
  );
}

function docRow(f, canDelete) {
  return (
    '<div class="doc-row" data-file-id="' + escapeHtml(f.fileId) + '">' +
    icon('doc', 'doc-row__icon') +
    '  <div class="doc-row__info"><strong>' + escapeHtml(f.fileName) + '</strong>' +
    '    <span class="muted small">' + formatBytes(f.sizeBytes) + ' &middot; ' + formatDate(f.uploadDate) + ' &middot; ' + escapeHtml(f.uploadedBy) + '</span></div>' +
    '  <button class="icon-btn" data-download-id="' + escapeHtml(f.fileId) + '" data-download-name="' + escapeHtml(f.fileName) + '" title="Download">' + icon('download') + '</button>' +
    (canDelete ? '<button class="icon-btn" data-delete-id="' + escapeHtml(f.fileId) + '" title="Delete">' + icon('trash') + '</button>' : '') +
    '</div>'
  );
}

function wireGalleryLazyThumbs(images) {
  var byId = {}; images.forEach(function (f) { byId[f.fileId] = f; });
  var tiles = document.querySelectorAll('.gallery-tile');
  if (!tiles.length) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var tile = entry.target;
      observer.unobserve(tile);
      var fileId = tile.getAttribute('data-file-id');
      Api.get('getFileContent', { fileId: fileId, thumbnail: 'true' }).then(function (res) {
        var wrap = tile.querySelector('.gallery-tile__thumb-wrap');
        wrap.innerHTML = '<img class="gallery-tile__thumb" src="data:' + res.mimeType + ';base64,' + res.base64 + '" alt="' + escapeHtml(res.fileName) + '">';
      }).catch(function () { /* thumbnail load failed silently — placeholder icon থাকবে */ });
    });
  }, { rootMargin: '150px' });
  tiles.forEach(function (t) { observer.observe(t); });
}

function wireGalleryClicks(images) {
  document.querySelectorAll('.gallery-tile').forEach(function (tile) {
    tile.addEventListener('click', function (e) {
      if (e.target.closest('.gallery-tile__delete')) return;
      var idx = Number(tile.getAttribute('data-idx'));
      openLightbox(images, idx);
    });
  });
}

function wireDeleteButtons(area, filters) {
  area.querySelectorAll('[data-delete-id]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('এই ফাইলটি মুছে ফেলতে চান?')) return;
      Api.post('deleteFile', { fileId: btn.getAttribute('data-delete-id') })
        .then(function () { Toast.success('ফাইল মুছে ফেলা হয়েছে'); loadFileArea(filters, true); })
        .catch(function (err) { Toast.error(err.message); });
    });
  });
}

function wireDownloadButtons(area) {
  area.querySelectorAll('[data-download-id]').forEach(function (btn) {
    btn.addEventListener('click', function () {
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

/* --------------------------------- Lightbox ----------------------------------- */

function openLightbox(images, idx) {
  var node = el(
    '<div class="lightbox">' +
    '  <button class="icon-btn lightbox__close">' + icon('close') + '</button>' +
    '  <button class="icon-btn lightbox__prev">' + icon('chevron') + '</button>' +
    '  <div class="lightbox__stage"><div class="spinner"></div></div>' +
    '  <button class="icon-btn lightbox__next" style="transform:scaleX(-1)">' + icon('chevron') + '</button>' +
    '  <div class="lightbox__caption"></div>' +
    '</div>'
  );
  document.body.appendChild(node);
  document.body.style.overflow = 'hidden';

  function close() { node.remove(); document.body.style.overflow = ''; }
  function show(i) {
    idx = (i + images.length) % images.length;
    var f = images[idx];
    node.querySelector('.lightbox__stage').innerHTML = '<div class="spinner"></div>';
    node.querySelector('.lightbox__caption').innerHTML =
      '<strong>' + escapeHtml(f.fileName) + '</strong><span class="mono">' + formatDate(f.uploadDate) + ' · ' + escapeHtml(f.contractorName) + ' · ' + escapeHtml(f.projectId) + '</span>';
    Api.get('getFileContent', { fileId: f.fileId }).then(function (res) {
      node.querySelector('.lightbox__stage').innerHTML = '<img src="data:' + res.mimeType + ';base64,' + res.base64 + '">';
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
    '<section class="section-head"><h1>Search</h1></section>' +
    '<form id="search-form" class="toolbar"><input type="text" name="q" id="search-q" placeholder="Contractor, Project ID, file name..." value="' + escapeHtml(query || '') + '"><button class="btn btn--primary btn--sm">' + icon('search') + ' Search</button></form>' +
    '<div id="search-results"></div>'
  );
  document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = document.getElementById('search-q').value.trim();
    location.hash = '#/search/' + encodeURIComponent(q);
  });
  if (!query) return;
  var results = document.getElementById('search-results');
  results.innerHTML = loadingHtml('খোঁজা হচ্ছে...');
  Api.get('listFiles', { search: query }).then(function (files) {
    if (!files.length) { results.innerHTML = '<div class="empty-state"><p>"' + escapeHtml(query) + '" এর জন্য কোনো ফলাফল পাওয়া যায়নি।</p></div>'; return; }
    var canDelete = Auth.isAdmin();
    var images = files.filter(function (f) { return f.isImage; });
    var docs = files.filter(function (f) { return !f.isImage; });
    results.innerHTML =
      '<p class="muted">' + files.length + ' ফলাফল পাওয়া গেছে</p>' +
      (images.length ? '<div class="gallery-grid">' + images.map(function (f, i) { return galleryTile(f, i, canDelete); }).join('') + '</div>' : '') +
      (docs.length ? '<div class="doc-list">' + docs.map(function (f) { return docRow(f, canDelete); }).join('') + '</div>' : '');
    wireGalleryLazyThumbs(images);
    wireGalleryClicks(images);
    wireDeleteButtons(results, { search: query });
    wireDownloadButtons(results);
  }).catch(function (err) { results.innerHTML = errorHtml(err.message); });
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
  if (!Auth.isAdmin()) { mount('<div class="empty-state"><p>এই পাতা দেখার অনুমতি আপনার নেই। Admin হিসেবে সাইন-ইন করুন।</p></div>'); return; }
  mount(
    '<section class="section-head"><h1>Admin Dashboard</h1></section>' +
    '<div class="admin-tabs">' + ADMIN_TABS.map(function (t) {
      return '<a class="tab-btn' + (t.key === tab ? ' tab-btn--active' : '') + '" href="#/admin/' + t.key + '">' + icon(t.icon) + '<span>' + t.label + '</span></a>';
    }).join('') + '</div>' +
    '<div id="admin-content">' + loadingHtml() + '</div>'
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
      statCard(s.totalContractors, 'Contractors') + statCard(s.totalProjects, 'Projects') +
      statCard(s.totalPhotos, 'Photos') + statCard(s.totalDocuments, 'Documents') + statCard(s.todaysUploads, "Today's Uploads") +
      '</section>' +
      '<table class="data-table"><thead><tr><th>Contractor</th><th>Projects</th><th>Photos</th><th>Documents</th></tr></thead><tbody>' +
      s.contractorStats.map(function (c) { return '<tr><td>' + escapeHtml(c.contractorName) + '</td><td>' + c.projects + '</td><td>' + c.photos + '</td><td>' + c.documents + '</td></tr>'; }).join('') +
      '</tbody></table>';
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function adminContractorsTab() {
  var box = document.getElementById('admin-content');
  Api.get('listContractors', {}).then(function (list) {
    box.innerHTML =
      '<div class="section-head"><h2></h2><button class="btn btn--primary btn--sm" id="add-c-btn">' + icon('plus') + ' Add Contractor</button></div>' +
      '<table class="data-table"><thead><tr><th>ID</th><th>Name</th><th>Projects</th><th>Files</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr><td class="mono">' + escapeHtml(c.contractorId) + '</td><td>' + escapeHtml(c.contractorName) + '</td><td>' + c.projectCount + '</td><td>' + c.fileCount + '</td>' +
          '<td><span class="badge ' + (c.status === 'Disabled' ? 'badge--muted' : 'badge--active') + '">' + escapeHtml(c.status) + '</span></td>' +
          '<td><button class="btn btn--ghost btn--sm" data-toggle-c="' + escapeHtml(c.contractorId) + '" data-status="' + (c.status === 'Disabled' ? 'Active' : 'Disabled') + '">' + (c.status === 'Disabled' ? 'Enable' : 'Disable') + '</button></td></tr>';
      }).join('') + '</tbody></table>';
    document.getElementById('add-c-btn').addEventListener('click', openAddContractorModal);
    box.querySelectorAll('[data-toggle-c]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Api.post('setContractorStatus', { contractorId: btn.getAttribute('data-toggle-c'), status: btn.getAttribute('data-status') })
          .then(function () { adminContractorsTab(); }).catch(function (err) { Toast.error(err.message); });
      });
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function openAddContractorModal() {
  var node = el(
    '<div class="modal modal--sm"><div class="modal__head"><h3>Add Contractor</h3><button class="icon-btn modal-close">' + icon('close') + '</button></div>' +
    '<div class="modal__body"><form id="add-c-form"><label>Contractor Name<input type="text" name="contractorName" required></label>' +
    '<button type="submit" class="btn btn--primary btn--block">Add</button></form></div></div>'
  );
  Modal.open(node);
  node.querySelector('#add-c-form').addEventListener('submit', function (e) {
    e.preventDefault();
    Api.post('addContractor', { contractorName: e.target.contractorName.value.trim() })
      .then(function () { Modal.close(); Toast.success('Contractor যোগ হয়েছে'); router(); })
      .catch(function (err) { Toast.error(err.message); });
  });
}

function adminProjectsTab() {
  var box = document.getElementById('admin-content');
  Promise.all([Api.get('listProjects', {}), Api.get('listContractors', {})]).then(function (res) {
    var projects = res[0], contractors = res[1];
    var byId = {}; contractors.forEach(function (c) { byId[c.contractorId] = c.contractorName; });
    box.innerHTML =
      '<div class="section-head"><h2></h2><button class="btn btn--primary btn--sm" id="add-p-btn">' + icon('plus') + ' New System</button></div>' +
      '<table class="data-table"><thead><tr><th>Project ID</th><th>Contractor</th><th>Name</th><th>Files</th><th>Status</th><th></th></tr></thead><tbody>' +
      projects.map(function (p) {
        return '<tr><td class="mono"><a href="#/project/' + encodeURIComponent(p.projectId) + '">' + escapeHtml(p.projectId) + '</a></td>' +
          '<td>' + escapeHtml(byId[p.contractorId] || p.contractorId) + '</td><td>' + escapeHtml(p.projectName) + '</td><td>' + p.fileCount + '</td>' +
          '<td><span class="badge ' + (p.status === 'Archived' ? 'badge--muted' : 'badge--active') + '">' + escapeHtml(p.status) + '</span></td>' +
          '<td class="btn-row"><button class="icon-btn" data-edit-p="' + escapeHtml(p.projectId) + '" data-name="' + escapeHtml(p.projectName) + '" title="Edit">' + icon('edit') + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-archive-p="' + escapeHtml(p.projectId) + '" data-status="' + (p.status === 'Archived' ? 'Active' : 'Archived') + '">' + (p.status === 'Archived' ? 'Unarchive' : 'Archive') + '</button></td></tr>';
      }).join('') + '</tbody></table>';
    document.getElementById('add-p-btn').addEventListener('click', function () { openNewSystemModal(''); });
    box.querySelectorAll('[data-edit-p]').forEach(function (btn) {
      btn.addEventListener('click', function () { openEditProjectModal(btn.getAttribute('data-edit-p'), btn.getAttribute('data-name')); });
    });
    box.querySelectorAll('[data-archive-p]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Api.post('archiveProject', { projectId: btn.getAttribute('data-archive-p'), status: btn.getAttribute('data-status') })
          .then(function () { adminProjectsTab(); }).catch(function (err) { Toast.error(err.message); });
      });
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function adminUsersTab() {
  var box = document.getElementById('admin-content');
  Api.get('listUsers', {}).then(function (users) {
    box.innerHTML =
      '<div class="section-head"><h2></h2><button class="btn btn--primary btn--sm" id="add-u-btn">' + icon('plus') + ' Add User</button></div>' +
      '<table class="data-table"><thead><tr><th>Email</th><th>Role</th><th>Contractor</th><th>Status</th><th></th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr><td>' + escapeHtml(u.email) + '</td><td>' + escapeHtml(u.role) + '</td><td>' + escapeHtml(u.contractorName) + '</td>' +
          '<td><span class="badge ' + (u.status === 'Disabled' ? 'badge--muted' : 'badge--active') + '">' + escapeHtml(u.status) + '</span></td>' +
          '<td class="btn-row"><button class="icon-btn" data-edit-u="' + escapeHtml(u.email) + '" data-role="' + escapeHtml(u.role) + '" data-cid="' + escapeHtml(u.contractorId) + '" title="Edit">' + icon('edit') + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-toggle-u="' + escapeHtml(u.email) + '" data-status="' + (u.status === 'Disabled' ? 'Active' : 'Disabled') + '">' + (u.status === 'Disabled' ? 'Enable' : 'Disable') + '</button></td></tr>';
      }).join('') + '</tbody></table>';
    document.getElementById('add-u-btn').addEventListener('click', function () { openAddUserModal(); });
    box.querySelectorAll('[data-edit-u]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditUserModal(btn.getAttribute('data-edit-u'), btn.getAttribute('data-role'), btn.getAttribute('data-cid'));
      });
    });
    box.querySelectorAll('[data-toggle-u]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Api.post('setUserStatus', { email: btn.getAttribute('data-toggle-u'), status: btn.getAttribute('data-status') })
          .then(function () { adminUsersTab(); }).catch(function (err) { Toast.error(err.message); });
      });
    });
  }).catch(function (err) { box.innerHTML = errorHtml(err.message); });
}

function openAddUserModal() {
  Api.get('listContractors', {}).then(function (contractors) {
    var node = el(
      '<div class="modal modal--sm"><div class="modal__head"><h3>Add User</h3><button class="icon-btn modal-close">' + icon('close') + '</button></div>' +
      '<div class="modal__body"><form id="add-u-form">' +
      '<label>Email (Google account)<input type="email" name="email" required></label>' +
      '<label>Role<select name="role" id="u-role"><option value="contractor">Contractor</option><option value="admin">Admin</option></select></label>' +
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
      '<div class="modal modal--sm"><div class="modal__head"><h3>Edit User</h3><button class="icon-btn modal-close">' + icon('close') + '</button></div>' +
      '<div class="modal__body"><form id="edit-u-form">' +
      '<label>Email<input type="email" value="' + escapeHtml(email) + '" disabled></label>' +
      '<label>Role<select name="role" id="eu-role"><option value="contractor"' + (currentRole === 'contractor' ? ' selected' : '') + '>Contractor</option><option value="admin"' + (currentRole === 'admin' ? ' selected' : '') + '>Admin</option></select></label>' +
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
    '<button class="btn btn--ghost btn--sm" id="a-refresh">' + icon('refresh') + '</button></div>' +
    '<div id="audit-table"></div>';

  function load() {
    var params = { userFilter: document.getElementById('a-user').value, projectId: document.getElementById('a-project').value, action: document.getElementById('a-action').value, dateFrom: document.getElementById('a-from').value, limit: 300 };
    var table = document.getElementById('audit-table');
    table.innerHTML = loadingHtml();
    Api.get('listAuditLog', params).then(function (rows) {
      if (!rows.length) { table.innerHTML = '<div class="empty-state"><p>কোনো লগ পাওয়া যায়নি।</p></div>'; return; }
      table.innerHTML = '<table class="data-table mono-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Project</th><th>File</th><th>Details</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + formatDate(r.timestamp) + '</td><td>' + escapeHtml(r.user) + '</td><td>' + escapeHtml(r.action) + '</td><td>' + escapeHtml(r.projectId) + '</td><td>' + escapeHtml(r.fileName) + '</td><td>' + escapeHtml(r.details) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function (err) { table.innerHTML = errorHtml(err.message); });
  }
  document.getElementById('a-refresh').addEventListener('click', load);
  load();
}

function adminTrashTab() {
  var box = document.getElementById('admin-content');
  box.innerHTML = '<p class="muted small" style="margin-bottom:12px">মুছে ফেলা ফাইলগুলো এখানে দেখা যায় — Restore করলে সেগুলো আবার প্রজেক্টের গ্যালারিতে ফিরে আসবে।</p><div id="trash-list">' + loadingHtml() + '</div>';
  var list = document.getElementById('trash-list');
  Api.get('listFiles', { trashOnly: 'true' }).then(function (files) {
    if (!files.length) { list.innerHTML = '<div class="empty-state"><p>Trash খালি।</p></div>'; return; }
    list.innerHTML = '<div class="doc-list">' + files.map(function (f) {
      return '<div class="doc-row"><span class="mono small muted">' + escapeHtml(f.projectId) + '</span>' +
        '<div class="doc-row__info"><strong>' + escapeHtml(f.fileName) + '</strong><span class="muted small">' + escapeHtml(f.category) + ' &middot; ' + formatDate(f.uploadDate) + '</span></div>' +
        '<button class="btn btn--ghost btn--sm" data-restore-id="' + escapeHtml(f.fileId) + '">Restore</button></div>';
    }).join('') + '</div>';
    list.querySelectorAll('[data-restore-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Api.post('restoreFile', { fileId: btn.getAttribute('data-restore-id') })
          .then(function () { Toast.success('ফাইল পুনরুদ্ধার করা হয়েছে'); adminTrashTab(); })
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

window.addEventListener('DOMContentLoaded', function () {
  renderShell();
  router();
});
window.addEventListener('hashchange', router);

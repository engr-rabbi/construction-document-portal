/**
 * utils.js — ছোট ছোট সাধারণ helper ফাংশন
 */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  bytes = Number(bytes) || 0;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var h = dt.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  var mins = ('0' + dt.getMinutes()).slice(-2);
  return dt.getDate() + '-' + months[dt.getMonth()] + '-' + dt.getFullYear() + ' ' + h + ':' + mins + ' ' + ampm;
}

/** শুধু তারিখ (সময় ছাড়া) — timeline/audit-এ কম্প্যাক্ট দেখানোর জন্য */
function formatDateShort(d) {
  if (!d) return '';
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return dt.getDate() + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
}

function debounce(fn, ms) {
  var t;
  return function () {
    var args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
}

function el(html) {
  var t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function qs(params) {
  return Object.keys(params)
    .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
    .join('&');
}

var Toast = (function () {
  var container;
  function ensure() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-stack';
      document.body.appendChild(container);
    }
    return container;
  }
  return {
    show: function (message, type) {
      var box = ensure();
      var iconName = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'spark';
      var t = el('<div class="toast toast--' + (type || 'info') + '" role="status">' + icon(iconName, 'toast__icon') + '<span>' + escapeHtml(message) + '</span></div>');
      box.appendChild(t);
      requestAnimationFrame(function () { t.classList.add('show'); });
      setTimeout(function () {
        t.classList.remove('show');
        setTimeout(function () { t.remove(); }, 250);
      }, 3500);
    },
    error: function (message) { this.show(message, 'error'); },
    success: function (message) { this.show(message, 'success'); }
  };
})();

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * সাধারণ canvas-ভিত্তিক resize+compress helper — maxDim ও quality parametrize করা।
 * শুধু ছবির জন্য কাজ করে (PDF/DOC ইত্যাদির জন্য null রিটার্ন করে)।
 */
function resizeImageToJpegBase64_(file, maxDim, quality) {
  if (!/^image\//.test(file.type)) return Promise.resolve(null);
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.width, h = img.height;
      var scale = Math.min(1, maxDim / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** গ্যালারি গ্রিডের ছোট প্রিভিউ থাম্বনেইলের জন্য (~৪০০px) */
function makeThumbnail(file) {
  var cfg = (window.APP_CONFIG && window.APP_CONFIG.THUMBNAIL) || { maxDim: 420, quality: 0.72 };
  return resizeImageToJpegBase64_(file, cfg.maxDim, cfg.quality);
}

/**
 * মূল আপলোডের জন্য ছবি compress করে — বড় ক্যামেরা/ফোন ছবি (কয়েক MB) resize+re-encode
 * করে অনেক ছোট (সাধারণত কয়েকশ' KB) করে দেয়, কিন্তু visually ভালো quality বজায় থাকে।
 * এর ফলে পরে Quick View/Download-এ লোডিং সময় অনেক কমে যায়। PDF/DOC/XLS-এর জন্য
 * এটা প্রযোজ্য না — সেগুলো অপরিবর্তিত আপলোড হয়।
 * রিটার্ন করে: { base64, mimeType, fileName } — resize ব্যর্থ হলে মূল ফাইলই fallback হিসেবে যায়।
 */
function compressImageForUpload(file) {
  if (!/^image\//.test(file.type)) {
    return fileToBase64(file).then(function (base64) {
      return { base64: base64, mimeType: file.type || 'application/octet-stream', fileName: file.name };
    });
  }
  var cfg = (window.APP_CONFIG && window.APP_CONFIG.UPLOAD_IMAGE) || { maxDim: 2000, quality: 0.85 };
  return resizeImageToJpegBase64_(file, cfg.maxDim, cfg.quality).then(function (base64) {
    if (!base64) {
      // Canvas resize কোনো কারণে ব্যর্থ হলে (যেমন corrupted image) মূল ফাইলই আপলোড হবে,
      // যাতে পুরো আপলোড আটকে না যায়
      return fileToBase64(file).then(function (b) { return { base64: b, mimeType: file.type, fileName: file.name }; });
    }
    var baseName = file.name.replace(/\.[^./\\]+$/, '');
    return { base64: base64, mimeType: 'image/jpeg', fileName: baseName + '.jpg' };
  });
}

/* ============================================================================
 *  নিচের সবকিছু নতুন — শুধু presentation layer (theme, skeleton, chart, sort,
 *  count-up, file-type badge)। কোনো API call বা business logic এখানে নেই।
 * ========================================================================== */

/* ---------------------------------- Theme (dark mode) ---------------------------------- */
var Theme = (function () {
  var KEY = 'cdp_theme';
  function get() { try { return localStorage.getItem(KEY) || 'light'; } catch (e) { return 'light'; } }
  function apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
  }
  function toggle() { apply(get() === 'dark' ? 'light' : 'dark'); return get(); }
  function init() { apply(get()); }
  return { get: get, apply: apply, toggle: toggle, init: init };
})();

/* ---------------------------------- Skeleton loaders ---------------------------------- */
function skeletonStatStrip(n) {
  n = n || 5;
  var out = '';
  for (var i = 0; i < n; i++) {
    out += '<div class="stat-card stat-card--skel"><div class="skeleton skeleton--icon"></div><div class="skeleton skeleton--text-lg"></div><div class="skeleton skeleton--text-sm"></div></div>';
  }
  return '<section class="stat-strip">' + out + '</section>';
}
function skeletonCards(n, cls) {
  n = n || 6;
  var out = '';
  for (var i = 0; i < n; i++) out += '<div class="skel-card"><div class="skeleton skeleton--block"></div><div class="skeleton skeleton--text-lg"></div><div class="skeleton skeleton--text-sm"></div></div>';
  return '<div class="' + (cls || 'project-grid') + '">' + out + '</div>';
}
function skeletonGallery(n) {
  n = n || 8;
  var out = '';
  for (var i = 0; i < n; i++) out += '<div class="skel-tile"><div class="skeleton skeleton--square"></div></div>';
  return '<div class="gallery-grid">' + out + '</div>';
}
function skeletonTable(rows, cols) {
  rows = rows || 5; cols = cols || 4;
  var body = '';
  for (var r = 0; r < rows; r++) {
    var tds = '';
    for (var c = 0; c < cols; c++) tds += '<td><div class="skeleton skeleton--text-sm"></div></td>';
    body += '<tr>' + tds + '</tr>';
  }
  return '<table class="data-table"><tbody>' + body + '</tbody></table>';
}

/* ---------------------------------- Count-up animation ---------------------------------- */
function animateCount(node, target) {
  target = Number(target) || 0;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = target;
    return;
  }
  var start = 0, t0 = null, duration = Math.min(900, 250 + target * 4);
  function step(ts) {
    if (!t0) t0 = ts;
    var p = Math.min(1, (ts - t0) / duration);
    var eased = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
    else node.textContent = target;
  }
  requestAnimationFrame(step);
}

/* ---------------------------------- Small real-data SVG charts ---------------------------------- */
/**
 * Donut chart — শুধু প্রকৃত সরবরাহকৃত সংখ্যা দিয়ে আঁকে, কোনো hard-coded/fake ডেটা নেই।
 * data: [{label, value, colorVar}]
 */
function renderDonutChart(data, size) {
  size = size || 120;
  var total = data.reduce(function (s, d) { return s + (Number(d.value) || 0); }, 0);
  var r = size / 2 - 10, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  if (!total) {
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="donut-chart"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="14"/></svg>';
  }
  var offset = 0, segs = '';
  data.forEach(function (d) {
    var v = Number(d.value) || 0;
    if (!v) return;
    var frac = v / total;
    var len = frac * circ;
    segs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (d.colorVar || 'var(--navy)') + '" stroke-width="14" ' +
      'stroke-dasharray="' + len.toFixed(2) + ' ' + (circ - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" stroke-linecap="butt" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
    offset += len;
  });
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" class="donut-chart">' + segs +
    '<text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" class="donut-chart__total">' + total + '</text>' +
    '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" class="donut-chart__label">total</text></svg>';
}

/** Horizontal bar list — real counts only. data: [{label, value, colorVar}] */
function renderBarChartHtml(data) {
  var max = Math.max.apply(null, data.map(function (d) { return Number(d.value) || 0; }).concat([1]));
  return '<div class="bar-chart">' + data.map(function (d) {
    var v = Number(d.value) || 0;
    var pct = Math.max(2, Math.round((v / max) * 100));
    return '<div class="bar-chart__row">' +
      '<span class="bar-chart__label">' + escapeHtml(d.label) + '</span>' +
      '<span class="bar-chart__track"><span class="bar-chart__fill" style="width:' + pct + '%;background:' + (d.colorVar || 'var(--navy)') + '"></span></span>' +
      '<span class="bar-chart__value mono">' + v + '</span>' +
      '</div>';
  }).join('') + '</div>';
}

function chartLegendHtml(data) {
  return '<div class="chart-legend">' + data.map(function (d) {
    return '<span class="chart-legend__item"><span class="chart-legend__dot" style="background:' + (d.colorVar || 'var(--navy)') + '"></span>' + escapeHtml(d.label) + ' <b>' + d.value + '</b></span>';
  }).join('') + '</div>';
}

/* ---------------------------------- File type metadata (derived from real filename) ---------------------------------- */
function fileTypeMeta(fileName) {
  var ext = String(fileName || '').split('.').pop().toLowerCase();
  var map = {
    pdf: { icon: 'doc', cls: 'ft--pdf', label: 'PDF' },
    doc: { icon: 'doc', cls: 'ft--word', label: 'DOC' },
    docx: { icon: 'doc', cls: 'ft--word', label: 'DOCX' },
    xls: { icon: 'sheet', cls: 'ft--sheet', label: 'XLS' },
    xlsx: { icon: 'sheet', cls: 'ft--sheet', label: 'XLSX' },
    dwg: { icon: 'ruler', cls: 'ft--cad', label: 'DWG' },
    dxf: { icon: 'ruler', cls: 'ft--cad', label: 'DXF' },
    jpg: { icon: 'image', cls: 'ft--image', label: 'JPG' },
    jpeg: { icon: 'image', cls: 'ft--image', label: 'JPEG' },
    png: { icon: 'image', cls: 'ft--image', label: 'PNG' },
    webp: { icon: 'image', cls: 'ft--image', label: 'WEBP' }
  };
  return map[ext] || { icon: 'doc', cls: 'ft--other', label: ext ? ext.toUpperCase() : 'FILE' };
}

/* ---------------------------------- Sortable table helper ---------------------------------- */
/**
 * থাকা row array-কে client-side sort করে re-render করে — কোনো নতুন API call লাগে না।
 * container: <table> element যার <thead> th গুলোতে data-sort-key আছে
 * rows: ডেটা array (already loaded), renderRow(row) => tr html string
 * tbodySelector: কোন tbody-তে বসাতে হবে
 */
function makeSortable(table, rows, renderRow, tbodyEl) {
  var state = { key: null, dir: 1 };
  function paint() {
    var sorted = rows.slice();
    if (state.key) {
      sorted.sort(function (a, b) {
        var av = (a[state.key] == null ? '' : a[state.key]), bv = (b[state.key] == null ? '' : b[state.key]);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * state.dir;
        return String(av).localeCompare(String(bv)) * state.dir;
      });
    }
    tbodyEl.innerHTML = sorted.map(renderRow).join('');
    return sorted;
  }
  table.querySelectorAll('th[data-sort-key]').forEach(function (th) {
    th.classList.add('is-sortable');
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort-key');
      state.dir = (state.key === k) ? -state.dir : 1;
      state.key = k;
      table.querySelectorAll('th[data-sort-key]').forEach(function (o) { o.classList.remove('sort-asc', 'sort-desc'); });
      th.classList.add(state.dir === 1 ? 'sort-asc' : 'sort-desc');
      paint();
    });
  });
  return { paint: paint };
}

/**
 * Admin table-এর জন্য combined client-side search + sort (কোনো নতুন API call ছাড়াই,
 * ইতিমধ্যে লোড করা array-এর উপর কাজ করে)। searchFields দিয়ে কোন কলামে টেক্সট-খোঁজা
 * হবে ঠিক করা যায়। rowActionsSelector-ভিত্তিক event delegation ব্যবহার করে, তাই re-sort/
 * re-filter এর পরও বাটন rebind করার দরকার নেই — কলার একবার tbody-তে delegated listener
 * বসালেই চলবে।
 */
function attachTableControls(opts) {
  var table = opts.table, tbody = opts.tbody, searchInput = opts.searchInput;
  var rows = opts.rows, renderRow = opts.renderRow, searchFields = opts.searchFields || [];
  var state = { q: '', key: null, dir: 1 };

  function matches(row) {
    if (!state.q) return true;
    var hay = searchFields.map(function (f) { return row[f] == null ? '' : String(row[f]); }).join(' ').toLowerCase();
    return hay.indexOf(state.q) !== -1;
  }
  function paint() {
    var out = rows.filter(matches);
    if (state.key) {
      out.sort(function (a, b) {
        var av = a[state.key] == null ? '' : a[state.key], bv = b[state.key] == null ? '' : b[state.key];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * state.dir;
        return String(av).localeCompare(String(bv)) * state.dir;
      });
    }
    tbody.innerHTML = out.length ? out.map(renderRow).join('') : '<tr><td colspan="12" class="muted small" style="padding:20px;text-align:center">কোনো ফলাফল নেই</td></tr>';
    return out;
  }
  if (table) {
    table.querySelectorAll('th[data-sort-key]').forEach(function (th) {
      th.classList.add('is-sortable');
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort-key');
        state.dir = (state.key === k) ? -state.dir : 1;
        state.key = k;
        table.querySelectorAll('th[data-sort-key]').forEach(function (o) { o.classList.remove('sort-asc', 'sort-desc'); });
        th.classList.add(state.dir === 1 ? 'sort-asc' : 'sort-desc');
        paint();
      });
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', debounce(function () { state.q = searchInput.value.trim().toLowerCase(); paint(); }, 200));
  }
  paint();
  return { paint: paint, setRows: function (r) { rows = r; paint(); } };
}

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
      var t = el('<div class="toast toast--' + (type || 'info') + '">' + escapeHtml(message) + '</div>');
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

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
 * ছবি আপলোডের আগে ব্রাউজারেই (canvas দিয়ে) একটা ছোট থাম্বনেইল (সর্বোচ্চ ~400px, JPEG)
 * বানিয়ে ফেলে। মূল ফাইল অপরিবর্তিত/পুরো রেজোলিউশনে আপলোড হয় — শুধু গ্যালারি প্রিভিউয়ের
 * জন্য এই ছোট কপিটা আলাদাভাবে পাঠানো হয়, যাতে গ্যালারি লোড অনেক দ্রুত হয়।
 * ছবি ছাড়া অন্য ফাইলের (PDF/DOC ইত্যাদি) জন্য null রিটার্ন করে।
 */
function makeThumbnail(file, maxDim, quality) {
  maxDim = maxDim || 420;
  quality = quality || 0.72;
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
      var dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

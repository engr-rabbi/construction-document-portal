/**
 * api.js — Apps Script Web App-এর সাথে কথা বলার একমাত্র জায়গা।
 *
 * গুরুত্বপূর্ণ: Content-Type "text/plain" রাখা হয় ইচ্ছাকৃতভাবে (application/json নয়)।
 * এতে ব্রাউজার এটাকে CORS "simple request" ধরে এবং OPTIONS preflight পাঠায় না —
 * কারণ Apps Script Web App preflight request ভালোভাবে হ্যান্ডেল করতে পারে না।
 */
var Api = (function () {
  function token() {
    return localStorage.getItem('cdp_session_token') || '';
  }

  function call(action, params, method) {
    params = params || {};
    method = method || 'GET';
    params.action = action;
    params.token = token();

    var url = window.APP_CONFIG.WEB_APP_URL;
    var opts = { method: method };

    if (method === 'GET') {
      var qs = Object.keys(params)
        .filter(function (k) { return params[k] !== undefined && params[k] !== null; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      url += '?' + qs;
    } else {
      opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      opts.body = JSON.stringify(params);
    }

    return fetch(url, opts)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || 'Unknown error');
        return res.data;
      });
  }

  return {
    get: function (action, params) { return call(action, params, 'GET'); },
    post: function (action, params) { return call(action, params, 'POST'); },
    /** fetch() দিয়ে upload progress পাওয়া যায় না, তাই বড় ফাইল আপলোডে (উপরে % দেখানোর জন্য)
     *  XMLHttpRequest ব্যবহার করা হয়। বাকি সব ছোট কলে সাধারণ fetch-ই যথেষ্ট। */
    postWithProgress: function (action, params, onProgress) {
      params = params || {};
      params.action = action;
      params.token = token();
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', window.APP_CONFIG.WEB_APP_URL, true);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          };
        }
        xhr.onload = function () {
          try {
            var res = JSON.parse(xhr.responseText);
            if (!res.ok) return reject(new Error(res.error || 'Unknown error'));
            resolve(res.data);
          } catch (e) { reject(new Error('Invalid response from server')); }
        };
        xhr.onerror = function () { reject(new Error('Network error')); };
        xhr.send(JSON.stringify(params));
      });
    }
  };
})();

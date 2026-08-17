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
    post: function (action, params) { return call(action, params, 'POST'); }
    // দ্রষ্টব্য: এখানে ইচ্ছাকৃতভাবে কোনো "postWithProgress" (xhr.upload.onprogress-ভিত্তিক)
    // ফাংশন নেই। কারণ: xhr.upload-এ কোনো progress listener লাগানো মাত্র ব্রাউজার সেই
    // request-কে আর "simple/CORS-preflight-free" request হিসেবে গণ্য করে না — একটা
    // OPTIONS preflight request পাঠায়। Apps Script Web App-এর কোনো doOptions() নেই এবং
    // preflight handle করতে পারে না, ফলে পুরো upload ব্যর্থ হয়ে "Network error" দেখায়।
    // তাই real byte-level progress দেখানো এই architecture-এ সম্ভব না — app.js-এ তাই
    // upload-এর সময় একটা simulated/animated progress bar ব্যবহার করা হয়েছে।
  };
})();

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
      .catch(function () {
        // fetch() নিজেই reject করে শুধু তখন যখন নেটওয়ার্ক সম্পূর্ণ ব্যর্থ হয় (অফলাইন/DNS/CORS) —
        // raw "Failed to fetch"-এর বদলে একটা স্পষ্ট, বোধগম্য বার্তায় রূপান্তর করা হয়
        // (§১০: Network error gracefully handle করা)।
        throw new Error('নেটওয়ার্ক error — ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।');
      })
      .then(function (r) {
        // r.json() সরাসরি ব্যবহার না করে আগে raw text নেওয়া হয়, কারণ Apps Script
        // execution timeout/quota-এর মতো বিরল ক্ষেত্রে HTML error page ফেরত দিতে পারে
        // (আমাদের নিজস্ব JSON ফরম্যাটে না) — তখন JSON.parse ব্যর্থ হলে একটা পরিষ্কার
        // বার্তা দেখানো হয়, cryptic "Unexpected token <" এর বদলে।
        return r.text().then(function (text) {
          var res;
          try { res = JSON.parse(text); }
          catch (e) { throw new Error('সার্ভার থেকে অপ্রত্যাশিত রেসপন্স এসেছে (HTTP ' + r.status + ')। কিছুক্ষণ পর আবার চেষ্টা করুন।'); }
          return res;
        });
      })
      .then(function (res) {
        if (!res.ok) {
          if (res.error && res.error.indexOf('SESSION_EXPIRED') === 0) handleSessionExpired_();
          throw new Error(res.error || 'Unknown error');
        }
        return res.data;
      });
  }

  // token থাকা সত্ত্বেও backend সেটাকে invalid/expired বলছে — মানে UI-তে হয়তো এখনো
  // পুরনো "Admin"/"Contractor" badge দেখাচ্ছে কিন্তু আসলে সেশন আর বৈধ না। এই অবস্থায়
  // পুরনো localStorage session মুছে ফেলে app.js-কে জানানো হয় (পরিষ্কারভাবে আবার
  // সাইন-ইন করানোর জন্য), যাতে একটা ধোঁয়াশাপূর্ণ FORBIDDEN error দেখে ইউজার আটকে না যায়।
  var sessionExpiredHandled = false;
  function handleSessionExpired_() {
    if (sessionExpiredHandled) return;
    sessionExpiredHandled = true;
    localStorage.removeItem('cdp_session_token');
    localStorage.removeItem('cdp_user');
    if (window.onSessionExpired) window.onSessionExpired();
    setTimeout(function () { sessionExpiredHandled = false; }, 4000);
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

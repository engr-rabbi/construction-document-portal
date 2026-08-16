/**
 * config.js
 * ---------------------------------------------------------------------------
 * Deploy করার পর এই দুইটা মান বসাতে হবে। এগুলো secret নয় — Web App URL এবং
 * OAuth Client ID পাবলিকভাবে জানা থাকলেও কোনো সমস্যা নেই, কারণ প্রকৃত
 * access-control সম্পূর্ণভাবে server-side (Apps Script + Users sheet) এ হয়।
 * ---------------------------------------------------------------------------
 */
window.APP_CONFIG = {
  // Apps Script Editor > Deploy > New deployment > Web app -> এখানে URL বসান
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxAWG7_aGxOo-E_rOKlenQez70bZ-A1JrnUvVbC46kD3fY7lVp84PGUEO7kSb9mrnYA/exec',

  // Google Cloud Console > APIs & Services > Credentials > OAuth Client ID (Web application)
  GOOGLE_CLIENT_ID: '1085661093981-4g5ok9v93dec5fhshfbj8vco1uonm49t.apps.googleusercontent.com',

  APP_NAME: 'Construction Document Portal',
  CATEGORIES: [
    { key: 'Construction Time Picture', icon: 'camera', label: 'Construction Time Picture' },
    { key: 'Completion Picture', icon: 'flag', label: 'Completion Picture' },
    { key: 'MB Scan Copy', icon: 'book', label: 'MB Scan Copy' },
    { key: 'Drawing Scan Copy', icon: 'ruler', label: 'Drawing Scan Copy' }
  ]
};

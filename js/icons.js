/**
 * icons.js — ছোট, self-contained line-icon সেট (কোনো external CDN নির্ভরতা ছাড়াই)
 * সব আগের icon অপরিবর্তিত রাখা হয়েছে; নতুন UI (dark mode, sort, filter, file-type
 * badge, chart legend, command palette) এর জন্য কিছু নতুন icon যোগ করা হয়েছে।
 */
var Icons = {
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  flag: '<path d="M5 3v18"/><path d="M5 4h11l-2.5 4L16 12H5"/>',
  book: '<path d="M5 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5z"/><path d="M19 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  ruler: '<path d="M3 16 16 3l5 5-13 13z"/><path d="m9 9 2 2M13 5l2 2M7 13l2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 4v12"/><path d="m6 12 6 6 6-6"/><path d="M4 20h16"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M5 5l14 14M19 5 5 19"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5-9 9"/>',
  doc: '<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/>',
  refresh: '<path d="M20 11A8 8 0 1 0 6.3 6.3L4 8.6"/><path d="M4 4v5h5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 8a3 3 0 1 1 0 6"/><path d="M15 20a6 6 0 0 0-.5-2.4"/>',
  log: '<path d="M4 4h16v4H4z"/><path d="M4 12h16M4 16h10M4 20h13"/>',
  building: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/><path d="M3 21h18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  /* --- নতুন icon --- */
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  sort: '<path d="M7 4v16M7 4l-3 3M7 4l3 3"/><path d="M17 20V4M17 20l3-3M17 20l-3-3"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  sheet: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M9 9v11"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.4 2.4L16 9.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'
};
function icon(name, cls) {
  return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (Icons[name] || '') + '</svg>';
}

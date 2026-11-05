// Small inline SVG icon set (24px grid, 1.75 stroke). Decorative by default.
const P = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  route: <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/></>,
  poll: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z"/><circle cx="16.5" cy="14.5" r="1.2"/></>,
  check: <><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="m8 12.5 2.8 2.8L16.5 9"/></>,
  note: <><path d="M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M15 20v-4a1 1 0 0 1 1-1h4M8 9h8M8 13h4"/></>,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>,
  x: <path d="M6 6l12 12M18 6 6 18"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></>,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 20h16"/>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5A3 3 0 0 1 16 10M12 13v4M8.5 20h7M10 17h4"/></>,
  arrow: <path d="M4 12h15M13 6l6 6-6 6"/>,
  back: <path d="M20 12H5M11 6l-6 6 6 6"/>,
  logout: <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15.5 8 20 12l-4.5 4M20 12H9"/></>,
  key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l3 3M14 9l2 2"/></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>,
  camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></>,
  landmark: <><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></>,
  food: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17"/></>,
  car: <><path d="M5 16.5V12l2-5.5A1 1 0 0 1 8 5.8h8a1 1 0 0 1 1 .7L19 12v4.5M3.5 16.5h17V19a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1v-1.5H7V19a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-2.5Z"/><circle cx="7.5" cy="13.5" r=".6"/><circle cx="16.5" cy="13.5" r=".6"/></>,
  bed: <><path d="M3 18V6M3 14h18v4M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5"/><circle cx="7" cy="11" r="1.8"/></>,
  party: <><path d="m4 20 4.5-12 7.5 7.5L4 20Z"/><path d="M14 4v2M19 8h2M18 3.5l-1 1.5M12 9.5l.5-.5"/></>,
  handshake: <><path d="m12 7 3.5-2.5L21 9v5l-3 1.5M12 7 8.5 4.5 3 9v5l7 5 2-1.5"/><path d="m9 13 2.5 2.5a1.7 1.7 0 0 0 2.4 0M12 17.5l1.5 1.5a1.7 1.7 0 0 0 2.4 0l3.1-3"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z"/></>,
  gear: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>,
};

export default function Icon({ name, size = 20, label, className = '' }) {
  return (
    <svg className={'ic ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}>
      {P[name]}
    </svg>
  );
}

// Brand mark: two stops joined by a route
export const Mark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="9" fill="var(--brand)" />
    <path d="M9.5 21.5c0-4 3-4 6.5-4s6.5 0 6.5-4.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="9.5" cy="21.5" r="3" fill="#fff" />
    <circle cx="22.5" cy="11" r="3" fill="var(--accent)" stroke="#fff" strokeWidth="1.6" />
  </svg>
);

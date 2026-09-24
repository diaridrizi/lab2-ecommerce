// Small inline SVG icons (no icon library needed)
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const SearchIcon = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const UserIcon = (p) => <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
export const BagIcon = (p) => <svg {...base} {...p}><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
export const MenuIcon = (p) => <svg {...base} {...p}><path d="M3 6h18M3 12h18M3 18h18" /></svg>;
export const CloseIcon = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const ArrowLeft = (p) => <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const ArrowRight = (p) => <svg {...base} {...p}><path d="M9 5l7 7-7 7" /></svg>;
export const TruckIcon = (p) => <svg {...base} {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>;
export const SparkIcon = (p) => <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>;
export const CashIcon = (p) => <svg {...base} {...p}><rect x="3" y="6" width="18" height="12" rx="1" /><circle cx="12" cy="12" r="2.5" /></svg>;
export const TrashIcon = (p) => <svg {...base} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const CardIcon = (p) => <svg {...base} {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></svg>;
export const LockIcon = (p) => <svg {...base} {...p}><rect x="5" y="11" width="14" height="10" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
export const BellIcon = (p) => <svg {...base} {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
export const ShieldIcon = (p) => <svg {...base} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;

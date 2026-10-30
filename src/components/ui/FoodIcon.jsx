import { Drumstick, Flame, Sandwich, CupSoda } from 'lucide-react';

export default function FoodIcon({ name, ...props }) {
  const icons = { drumstick: Drumstick, crispy: Drumstick, flame: Flame, sandwich: Sandwich, cup: CupSoda };
  const Icon = icons[name];
  if (Icon) return <Icon aria-hidden="true" {...props} />;
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m9 17 3 18h16l3-18H9Z M13 17l-1-9 5-1 2 10 M20 17V4h5v13 M26 17l3-10 4 2-2 8 M16 23v6 M24 23v6" />
    </svg>
  );
}

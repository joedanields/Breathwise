import type { NaqiCategory } from '@shared/types';
import { Frown, Meh, OctagonAlert, Smile, TriangleAlert, type LucideIcon } from 'lucide-react';
import { CATEGORY_LABELS } from '@/lib/aqi/categories';
import { CATEGORY_CLASSES } from './categoryClasses';

/** A distinct shape per category, so colour is never the only signal (UI_UX.md §6). */
const ICONS: Readonly<Record<NaqiCategory, LucideIcon>> = {
  good: Smile,
  satisfactory: Smile,
  moderate: Meh,
  poor: Frown,
  very_poor: TriangleAlert,
  severe: OctagonAlert,
};

export function CategoryIcon({
  category,
  className = 'size-5',
}: {
  category: NaqiCategory;
  className?: string;
}) {
  const Icon = ICONS[category];
  return <Icon aria-hidden="true" focusable="false" className={className} />;
}

/** Category badge: icon + text on the category colour. */
export function CategoryBadge({ category }: { category: NaqiCategory }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${CATEGORY_CLASSES[category]}`}
    >
      <CategoryIcon category={category} className="size-4" />
      {CATEGORY_LABELS[category]}
    </span>
  );
}

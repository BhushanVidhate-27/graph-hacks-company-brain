// Shared motion tokens. The easing curve mirrors the CSS transitions used by
// the CAD buttons, so Motion-driven reveals and CSS hover states feel related.
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const SPRING_SOFT = {
  type: 'spring',
  stiffness: 140,
  damping: 26,
  mass: 1.2,
} as const;

/**
 * apps/web/src/icons/ServiceIcon.tsx
 *
 * Renders a Cloudflare service icon from the SVG sprite at /icons/sprite.svg.
 *
 * Accessibility:
 *   - Uses role="img" + aria-label so screen readers announce the service name.
 *   - Falls back to an accessible labelled <span> when iconId is absent or
 *     when the sprite fails to load the referenced symbol.
 *
 * Usage:
 *   <ServiceIcon iconId="workers-kv" name="Workers KV" />
 *   <ServiceIcon iconId="workers-kv" name="Workers KV" size={32} />
 *
 * See apps/web/src/icons/ICONS.md for sprite regeneration instructions.
 */

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceIconProps {
  /** Symbol ID in the sprite — matches the filename stem of the source SVG. */
  iconId: string;
  /** Accessible label announced by screen readers; also used as a tooltip. */
  name: string;
  /** Width/height in pixels. Defaults to 24. */
  size?: number;
  /** Additional CSS class applied to the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a service icon via an SVG `<use>` reference to the committed sprite.
 *
 * Falls back to an accessible placeholder `<span>` when:
 *   - `iconId` is an empty string
 *   - The `<use>` reference fails to load (missing symbol in the sprite)
 */
export function ServiceIcon({ iconId, name, size = 24, className }: ServiceIconProps) {
  const [failed, setFailed] = useState(false);

  const placeholderStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    borderRadius: 4,
    backgroundColor: "var(--color-bg-secondary, #f0f0f0)",
    fontSize: Math.max(8, Math.floor(size * 0.4)),
    lineHeight: 1,
    color: "var(--color-text-secondary, #6b7280)",
    fontWeight: 700,
    userSelect: "none",
    flexShrink: 0,
  };

  // Render accessible placeholder when iconId is empty/missing or sprite load failed
  if (!iconId || failed) {
    // Use the first character of the name as a compact fallback indicator
    const initial = name.trim().charAt(0).toUpperCase();
    return (
      <span
        role="img"
        aria-label={name}
        title={name}
        style={placeholderStyle}
        {...(className !== undefined ? { className } : {})}
      >
        {initial}
      </span>
    );
  }

  return (
    <svg
      role="img"
      aria-label={name}
      width={size}
      height={size}
      style={{ display: "inline-block", flexShrink: 0 }}
      {...(className !== undefined ? { className } : {})}
    >
      {/* <title> provides a browser tooltip and is the SVG-native way to annotate icons */}
      <title>{name}</title>
      <use href={`/icons/sprite.svg#${iconId}`} onError={() => setFailed(true)} />
    </svg>
  );
}

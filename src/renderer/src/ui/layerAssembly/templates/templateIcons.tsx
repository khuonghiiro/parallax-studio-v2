import type { ReactNode } from 'react'

export function renderTemplateThumbnail(templateId: string, size = 48): ReactNode {
  switch (templateId) {
    case 'tmpl-character-front':
    case 'tmpl-character-male-hero':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="16" r="9" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M28 15h2M34 15h2M29 20c1.5 1.2 4.5 1.2 6 0" stroke="var(--key)" />
          <path d="M22 60v-16l-4-12 14-6 14 6-4 12v16" stroke="var(--accent)" fill="var(--bg-2)" />
          <path d="M18 32l-7 14M46 32l7 14" stroke="var(--accent-cyan)" />
          <path d="M26 44h12M24 60h16" />
        </svg>
      )
    case 'tmpl-character-quarter':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="34" cy="16" r="9" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M33 15h2M39 15h2M34 20c1.5 1 4 1 5 0" stroke="var(--key)" />
          <path d="M24 60v-16l-2-12 12-6 10 6-2 12v16" stroke="var(--accent)" fill="var(--bg-2)" />
          <path d="M22 32l-6 14M42 32l6 12" stroke="var(--accent-cyan)" />
        </svg>
      )
    case 'tmpl-character-back':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="16" r="9" fill="var(--bg-3)" stroke="var(--text-dim)" />
          <path d="M25 12c3-4 11-4 14 0M26 18c4 2 8 2 12 0" stroke="var(--accent-cyan)" />
          <path d="M22 60v-16l-4-12 14-6 14 6-4 12v16" stroke="var(--accent)" fill="var(--bg-2)" />
          <path d="M23 39h18" stroke="var(--key)" />
        </svg>
      )
    case 'tmpl-animal-dog':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="32" cy="34" rx="16" ry="10" fill="var(--bg-2)" stroke="var(--accent)" />
          <circle cx="16" cy="24" r="8" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M18 20c-3 6-8 6-8 1" stroke="var(--text-dim)" strokeWidth="2.5" />
          <path d="M48 30c6-6 10-2 10 4" stroke="var(--key)" strokeWidth="2.6" />
          <path d="M22 42v16M28 42v16M38 42v16M44 42v16" stroke="var(--text)" />
        </svg>
      )
    case 'tmpl-animal-fish':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 32c10-14 30-10 38 0-8 10-28 14-38 0z" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M50 32l10-10v20l-10-10z" fill="var(--bg-3)" stroke="var(--key)" />
          <path d="M26 22c4-8 12-6 16-2M26 42c4 8 12 6 16 2" stroke="var(--accent-cyan)" />
          <circle cx="18" cy="30" r="2" fill="var(--text)" />
        </svg>
      )
    case 'tmpl-animal-rooster':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="20" cy="22" r="7" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M16 16c0-6 4-6 6-2 2-4 6-4 6 0" stroke="var(--key)" strokeWidth="2.5" />
          <path d="M13 22l-6 2 6 2" stroke="var(--key)" fill="var(--key)" />
          <ellipse cx="32" cy="34" rx="14" ry="10" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M44 32c8-8 16-4 16 8s-8 14-16 4" stroke="var(--accent-cyan)" strokeWidth="2.6" />
          <path d="M28 44v14M36 44v14" stroke="var(--key)" />
        </svg>
      )
    case 'tmpl-nature-modular-tree':
    case 'tmpl-nature-autumn-tree':
    case 'tmpl-nature-bonsai':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 52h32l-4 8H20l-4-8z" fill="var(--bg-3)" stroke="var(--key)" />
          <path d="M32 52c-2-12 10-18 2-26s-12-8-4-16" stroke="var(--text-dim)" strokeWidth="3" />
          <circle cx="22" cy="18" r="8" fill="var(--bg-2)" stroke="var(--accent-cyan)" />
          <circle cx="38" cy="22" r="10" fill="var(--bg-2)" stroke="var(--accent)" />
          <circle cx="28" cy="10" r="6" fill="var(--bg-2)" stroke="var(--accent-cyan)" />
        </svg>
      )
    case 'tmpl-nature-modular-rock':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 50l8-22 14-8 16 10 4 20H12z" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M18 28c6-4 16-4 24 0" stroke="var(--accent-cyan)" strokeWidth="3" />
          <path d="M44 16l4-6 4 8-4 6" stroke="var(--key)" />
        </svg>
      )
    case 'tmpl-nature-flower-bush':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 56c8-16 16-12 20-8 6-12 16-14 20 8" stroke="var(--text-dim)" />
          <path d="M32 56c0-16 4-22 0-32" stroke="var(--accent)" strokeWidth="2.6" />
          <circle cx="32" cy="22" r="12" fill="var(--bg-2)" stroke="var(--accent-cyan)" />
          <circle cx="32" cy="22" r="5" fill="var(--key)" stroke="var(--key)" />
        </svg>
      )
    case 'tmpl-arch-window':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="18" y="10" width="28" height="34" rx="2" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M32 10v34M18 26h28" stroke="var(--accent-cyan)" />
          <rect x="14" y="44" width="36" height="10" rx="2" fill="var(--bg-3)" stroke="var(--key)" />
          <path d="M18 44c4-6 10-6 14 0s10-6 14 0" stroke="var(--accent-cyan)" />
        </svg>
      )
    case 'tmpl-arch-ruins':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 56V26c0-10 8-16 18-16s18 6 18 16v30" stroke="var(--text-dim)" strokeWidth="3" />
          <path d="M22 56V30c0-6 4-10 10-10s10 4 10 10v26" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M20 20c2 10 6 8 8 16M42 22c-2 8-4 12-2 18" stroke="var(--accent-cyan)" />
          <circle cx="28" cy="38" r="1.5" fill="var(--key)" />
          <circle cx="36" cy="32" r="1.5" fill="var(--key)" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="16" y="16" width="32" height="32" rx="4" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M16 28h32M28 28v20" stroke="var(--accent-cyan)" />
        </svg>
      )
  }
}

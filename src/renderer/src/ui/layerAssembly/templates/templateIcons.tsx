import type { ReactNode } from 'react'

export function renderTemplateThumbnail(templateId: string, size = 48): ReactNode {
  switch (templateId) {
    case 'tmpl-character-shadiao-panda':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="21" cy="10" r="4" fill="var(--text)" />
          <circle cx="43" cy="10" r="4" fill="var(--text)" />
          <circle cx="32" cy="18" r="11" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M27 16h3M34 16h3M27 22c2 1.8 8 1.8 10 0" stroke="var(--text)" />
          <path d="M28 6h8v4h-8z" fill="var(--key)" stroke="var(--key)" />
          <path d="M20 30l12-2 12 2-3 18H23l-3-18z" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M26 48v12M38 48v12M18 32l-7 12M46 32l7 12" stroke="var(--text)" />
        </svg>
      )
    case 'tmpl-character-shadiao-modern':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="19" r="11" fill="var(--bg-3)" stroke="var(--text)" />
          <path d="M20 18c0-8 5-12 12-12s12 4 12 12H20z" fill="var(--text)" />
          <rect x="25" y="19" width="5" height="3" fill="var(--accent-cyan)" />
          <rect x="34" y="19" width="5" height="3" fill="var(--accent-cyan)" />
          <path d="M28 25c2 1.5 6 1.5 8 0" stroke="var(--key)" />
          <path d="M22 31h20v15H22z" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M26 46v13M38 46v13M18 33l-6 11M46 33l6 11" stroke="var(--text)" />
        </svg>
      )
    case 'tmpl-character-articulated-13':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="var(--accent)" strokeWidth="2">
          <circle cx="32" cy="10" r="6" />
          <path d="M24 21h16v20H24zM24 23l-8 10v10m24-20 8 10v10M27 41v15m10-15v15" />
          <path d="M13 43h6v7h-6zm32 0h6v7h-6zM21 56h9v5h-9zm13 0h9v5h-9z" fill="var(--key)" stroke="var(--key)" />
        </svg>
      )
    case 'tmpl-character-male-hero':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="16" r="8" fill="var(--bg-3)" />
          <path d="M22 60v-16l-4-12 14-8 14 8-4 12v16" stroke="var(--accent)" fill="var(--bg-2)" />
          <path d="M18 32l-8 14M46 32l8 14" stroke="var(--accent-cyan)" />
          <path d="M26 44h12M24 60h16" />
        </svg>
      )
    case 'tmpl-character-female-anime':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 16c0 14 6 22 16 22s16-8 16-22c0-8-7-12-16-12s-16 4-16 12z" fill="var(--bg-3)" stroke="var(--text-faint)" />
          <circle cx="32" cy="18" r="7" fill="var(--bg-2)" stroke="var(--accent-cyan)" />
          <path d="M22 36l10-4 10 4-4 14H26l-4-14z" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M20 50l-4 12M44 50l4 12M26 50v12M38 50v12" stroke="var(--text)" />
        </svg>
      )
    case 'tmpl-character-child-kid':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="20" r="12" fill="var(--bg-3)" stroke="var(--key)" />
          <path d="M20 16c2-8 18-10 24-2" stroke="var(--accent-cyan)" strokeWidth="3" />
          <path d="M24 34v12h16V34M24 38h16" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M26 46v12M38 46v12M18 36l-4 8M46 36l4 8" stroke="var(--text)" />
        </svg>
      )
    case 'tmpl-character-middleaged-man':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="24" y="8" width="16" height="18" rx="8" fill="var(--bg-3)" stroke="var(--text-dim)" />
          <path d="M26 16h12M28 14h3v4h-3zM33 14h3v4h-3z" stroke="var(--accent-cyan)" />
          <path d="M18 30l14 4 14-4v16H18V30z" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M32 34l-2 8 2 2 2-2-2-8z" fill="var(--key)" stroke="var(--key)" />
          <path d="M22 46v14M42 46v14" stroke="var(--text)" />
        </svg>
      )
    case 'tmpl-character-elderly-grandpa':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="28" cy="16" r="8" fill="var(--bg-3)" stroke="var(--text-faint)" />
          <path d="M24 20c0 6 4 10 8 10s8-4 8-10" stroke="var(--text-dim)" strokeWidth="2.5" />
          <path d="M20 28c4 10 2 22 2 32h14c0-12 2-20-4-32" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M46 22c-2-6-8-4-8 0v38" stroke="var(--key)" strokeWidth="2.6" />
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
    case 'tmpl-animal-buffalo':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="34" cy="34" rx="18" ry="12" fill="var(--bg-2)" stroke="var(--accent)" />
          <circle cx="14" cy="26" r="9" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M14 20c-4-10-12-8-12-2M18 18c6-10 14-8 14-2" stroke="var(--key)" strokeWidth="3" />
          <path d="M20 44v14M26 44v14M42 44v14M48 44v14" stroke="var(--text)" strokeWidth="2.6" />
        </svg>
      )
    case 'tmpl-animal-cat':
      return (
        <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="30" cy="36" rx="14" ry="9" fill="var(--bg-2)" stroke="var(--accent)" />
          <circle cx="16" cy="26" r="7" fill="var(--bg-3)" stroke="var(--accent-cyan)" />
          <path d="M12 21l-2-6 6 3M18 20l4-5-1 6" stroke="var(--accent-cyan)" />
          <path d="M44 34c8-4 12-14 10-20" stroke="var(--key)" strokeWidth="2.4" />
          <path d="M22 44v12M28 44v12M34 44v12M40 44v12" stroke="var(--text)" />
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
          <path d="M16 16c0-6 4-6 6-2 2-4 6-4 6 0" stroke="red" strokeWidth="2.5" />
          <path d="M13 22l-6 2 6 2" stroke="var(--key)" fill="var(--key)" />
          <ellipse cx="32" cy="34" rx="14" ry="10" fill="var(--bg-2)" stroke="var(--accent)" />
          <path d="M44 32c8-8 16-4 16 8s-8 14-16 4" stroke="var(--accent-cyan)" strokeWidth="2.6" />
          <path d="M28 44v14M36 44v14" stroke="var(--key)" />
        </svg>
      )
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

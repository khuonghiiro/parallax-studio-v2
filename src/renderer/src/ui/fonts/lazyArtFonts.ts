/**
 * Tải động (on-demand) các font nghệ thuật khi cần dựng Text Layer hoặc mở Font Picker,
 * giúp App khởi động tức thì mà không phải nạp trước hàng chục file CSS/WOFF2 lúc ban đầu.
 */
let loadedArtFonts = false

export function ensureArtFontsLoaded(): void {
  if (loadedArtFonts || typeof window === 'undefined') return
  loadedArtFonts = true

  Promise.all([
    import('@fontsource/montserrat/400.css'),
    import('@fontsource/montserrat/700.css'),
    import('@fontsource/montserrat/800.css'),
    import('@fontsource/playfair-display/400.css'),
    import('@fontsource/playfair-display/700.css'),
    import('@fontsource/bebas-neue/400.css')
  ]).catch((err) => {
    console.warn('[Fonts] Failed to load art fonts on demand:', err)
  })
}

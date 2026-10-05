export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function parseDataUrl(url: string): { mime: string; data: Uint8Array } {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/)
  if (!m) throw new Error('Invalid data URL: must start with data:<mime>;base64,...')
  const mime = m[1]
  const isBase64 = m[2] === ';base64'
  const raw = m[3]
  const data = isBase64 ? base64ToUint8Array(raw) : new TextEncoder().encode(decodeURIComponent(raw))
  return { mime, data }
}

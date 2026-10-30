import { generateKeyPairSync, randomBytes, createSign } from 'crypto'

function derLength(len: number): Buffer {
  if (len < 128) return Buffer.from([len])
  const bytes: number[] = []
  let n = len
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

function derTag(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content])
}

function derSeq(items: Buffer[]): Buffer {
  return derTag(0x30, Buffer.concat(items))
}

function derSet(items: Buffer[]): Buffer {
  return derTag(0x31, Buffer.concat(items))
}

function derOid(oidBytes: number[]): Buffer {
  return derTag(0x06, Buffer.from(oidBytes))
}

function derUtf8(str: string): Buffer {
  return derTag(0x0c, Buffer.from(str, 'utf8'))
}

function derUtcTime(date: Date): Buffer {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return derTag(0x17, Buffer.from(`${yy}${mm}${dd}${hh}${mi}${ss}Z`, 'ascii'))
}

function derBitString(content: Buffer): Buffer {
  return derTag(0x03, Buffer.concat([Buffer.from([0x00]), content]))
}

function derOctetString(content: Buffer): Buffer {
  return derTag(0x04, content)
}

function buildCommonNameRdn(cn: string): Buffer {
  // OID 2.5.4.3 (id-at-commonName) = 55 04 03
  return derSeq([derSet([derSeq([derOid([0x55, 0x04, 0x03]), derUtf8(cn)])])])
}

function buildSanExtension(ips: string[]): Buffer {
  const generalNames: Buffer[] = [
    // dNSName [2] "localhost"
    derTag(0x82, Buffer.from('localhost', 'ascii'))
  ]

  const allIps = Array.from(new Set(['127.0.0.1', ...ips]))
  for (const ip of allIps) {
    const parts = ip.split('.').map((x) => Number(x))
    if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      // iPAddress [7]
      generalNames.push(derTag(0x87, Buffer.from(parts)))
    }
  }

  const sanValue = derSeq(generalNames)
  // OID 2.5.29.17 (subjectAltName) = 55 1d 11
  const sanExt = derSeq([derOid([0x55, 0x1d, 0x11]), derOctetString(sanValue)])
  return derTag(0xa3, derSeq([sanExt]))
}

/**
 * Tạo chứng chỉ TLS X.509 v3 tự ký (Self-Signed Certificate) thuần Node.js crypto
 * kèm SubjectAltName cho mọi địa chỉ IPv4 LAN/Wi-Fi để hỗ trợ kết nối HTTPS-Only trên điện thoại.
 *
 * Dùng ECDSA P-256 (ecdh_curve prime256v1) thay RSA-2048 để tránh block Main Process:
 *   - RSA-2048 generateKeyPairSync: ~200–500ms (CPU-intensive, block toàn bộ Main thread)
 *   - ECDSA P-256 generateKeyPairSync: ~1–5ms (gần như tức thì)
 */
export function generateSelfSignedCert(ips: string[] = []): { key: string; cert: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

  // ecdsaWithSHA256 (1.2.840.10045.4.3.2) — OID bytes: 2a 86 48 ce 3d 04 03 02
  const sigAlg = derSeq([
    derOid([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02])
  ])

  const serialRaw = randomBytes(12)
  serialRaw[0] &= 0x7f
  if (serialRaw[0] === 0) serialRaw[0] = 1
  const serial = derTag(0x02, serialRaw)

  const versionV3 = derTag(0xa0, derTag(0x02, Buffer.from([0x02])))
  const name = buildCommonNameRdn('Parallax Studio LAN Remote')

  const now = new Date()
  const notBefore = new Date(now.getTime() - 24 * 3600 * 1000)
  const notAfter = new Date(now.getTime() + 3650 * 24 * 3600 * 1000)
  const validity = derSeq([derUtcTime(notBefore), derUtcTime(notAfter)])

  const tbs = derSeq([
    versionV3,
    serial,
    sigAlg,
    name,
    validity,
    name,
    spkiDer,
    buildSanExtension(ips)
  ])

  const signer = createSign('sha256')
  signer.update(tbs)
  const signature = signer.sign(privateKey)
  const certDer = derSeq([tbs, sigAlg, derBitString(signature)])
  const b64 = certDer.toString('base64').replace(/(.{64})/g, '$1\n').trim()
  const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`

  return { key: keyPem, cert: certPem }
}

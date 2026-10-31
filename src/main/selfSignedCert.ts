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

function derBoolTrue(): Buffer {
  return derTag(0x01, Buffer.from([0xff]))
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

function derBitString(content: Buffer, unusedBits = 0): Buffer {
  return derTag(0x03, Buffer.concat([Buffer.from([unusedBits & 0x07]), content]))
}

function derOctetString(content: Buffer): Buffer {
  return derTag(0x04, content)
}

function buildCommonNameRdn(cn: string): Buffer {
  // OID 2.5.4.3 (id-at-commonName) = 55 04 03
  return derSeq([derSet([derSeq([derOid([0x55, 0x04, 0x03]), derUtf8(cn)])])])
}

function buildV3Extensions(ips: string[]): Buffer {
  // 1. basicConstraints (2.5.29.19) = CA:FALSE (critical)
  const basicConstraintsExt = derSeq([
    derOid([0x55, 0x1d, 0x13]),
    derBoolTrue(),
    derOctetString(derSeq([]))
  ])

  // 2. keyUsage (2.5.29.15) = digitalSignature (bit 0 = 0x80, 7 unused bits, critical)
  const keyUsageExt = derSeq([
    derOid([0x55, 0x1d, 0x0f]),
    derBoolTrue(),
    derOctetString(derBitString(Buffer.from([0x80]), 7))
  ])

  // 3. extKeyUsage (2.5.29.37) = id-kp-serverAuth (1.3.6.1.5.5.7.3.1)
  const serverAuthOid = derOid([0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x01])
  const extKeyUsageExt = derSeq([
    derOid([0x55, 0x1d, 0x25]),
    derOctetString(derSeq([serverAuthOid]))
  ])

  // 4. subjectAltName (2.5.29.17) = DNS:localhost + IP:127.0.0.1 + mọi IPv4 LAN/Wi-Fi
  const generalNames: Buffer[] = [derTag(0x82, Buffer.from('localhost', 'ascii'))]
  const allIps = Array.from(new Set(['127.0.0.1', ...ips]))
  for (const ip of allIps) {
    const parts = ip.split('.').map((x) => Number(x))
    if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      generalNames.push(derTag(0x87, Buffer.from(parts)))
    }
  }
  const sanExt = derSeq([derOid([0x55, 0x1d, 0x11]), derOctetString(derSeq(generalNames))])

  return derTag(0xa3, derSeq([basicConstraintsExt, keyUsageExt, extKeyUsageExt, sanExt]))
}

/**
 * Tạo chứng chỉ TLS X.509 v3 tự ký (Self-Signed Leaf Certificate) thuần Node.js crypto:
 * - Đầy đủ BasicConstraints (CA:FALSE), KeyUsage (digitalSignature), ExtKeyUsage (serverAuth) và SubjectAltName (mọi IP LAN/Wi-Fi).
 * - Thời hạn 365 ngày (<= 398 ngày theo chuẩn Apple Safari / Chrome / Firefox cho chứng chỉ HTTPS-Only).
 * - Dùng ECDSA P-256 (~1–5ms, không block Main Process).
 */
export function generateSelfSignedCert(ips: string[] = []): { key: string; cert: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

  // ecdsaWithSHA256 (1.2.840.10045.4.3.2)
  const sigAlg = derSeq([derOid([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02])])

  const serialRaw = randomBytes(12)
  serialRaw[0] &= 0x7f
  if (serialRaw[0] === 0) serialRaw[0] = 1
  const serial = derTag(0x02, serialRaw)

  const versionV3 = derTag(0xa0, derTag(0x02, Buffer.from([0x02])))
  const name = buildCommonNameRdn('Parallax Studio LAN Remote')

  const now = new Date()
  const notBefore = new Date(now.getTime() - 24 * 3600 * 1000)
  // Giới hạn 365 ngày (dưới ngưỡng 398 ngày của Apple iOS/Safari & Chromium)
  const notAfter = new Date(now.getTime() + 365 * 24 * 3600 * 1000)
  const validity = derSeq([derUtcTime(notBefore), derUtcTime(notAfter)])

  const tbs = derSeq([
    versionV3,
    serial,
    sigAlg,
    name,
    validity,
    name,
    spkiDer,
    buildV3Extensions(ips)
  ])

  const signer = createSign('sha256')
  signer.update(tbs)
  const signature = signer.sign(privateKey)
  const certDer = derSeq([tbs, sigAlg, derBitString(signature)])
  const b64 = certDer.toString('base64').replace(/(.{64})/g, '$1\n').trim()
  const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`

  return { key: keyPem, cert: certPem }
}

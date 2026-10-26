import { describe, expect, it } from 'vitest'
import { X509Certificate } from 'crypto'
import { generateSelfSignedCert } from './selfSignedCert'

describe('generateSelfSignedCert', () => {
  it('generates a valid X.509 v3 self-signed certificate with SubjectAltName for LAN IPs', () => {
    const { key, cert } = generateSelfSignedCert(['192.168.100.239', '10.0.0.5'])
    expect(key).toContain('-----BEGIN PRIVATE KEY-----')
    expect(cert).toContain('-----BEGIN CERTIFICATE-----')

    const x509 = new X509Certificate(cert)
    expect(x509.subject).toContain('CN=Parallax Studio LAN Remote')
    expect(x509.subjectAltName).toContain('DNS:localhost')
    expect(x509.subjectAltName).toContain('IP Address:127.0.0.1')
    expect(x509.subjectAltName).toContain('IP Address:192.168.100.239')
    expect(x509.subjectAltName).toContain('IP Address:10.0.0.5')
    expect(x509.verify(x509.publicKey)).toBe(true)
  })
})

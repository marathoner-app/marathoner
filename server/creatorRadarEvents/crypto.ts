export interface Sha256Digester {
  digestUtf8(value: string): Promise<string>
}

function bytesToLowerHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export class WebCryptoSha256Digester implements Sha256Digester {
  constructor(private readonly subtle: Pick<SubtleCrypto, 'digest'> = globalThis.crypto.subtle) {}

  async digestUtf8(value: string): Promise<string> {
    const encoded = new TextEncoder().encode(value)
    const digest = await this.subtle.digest('SHA-256', encoded)
    return bytesToLowerHex(new Uint8Array(digest))
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not support non-finite numbers.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const fields = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    return `{${fields.join(',')}}`
  }
  throw new TypeError('Canonical JSON supports JSON values only.')
}

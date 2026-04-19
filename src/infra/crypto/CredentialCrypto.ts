import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getMasterKey(): Buffer {
  const raw = process.env.MASTER_KEY
  if (!raw || raw.length < 32) {
    throw new Error('MASTER_KEY manquant ou trop court (minimum 32 caractères)')
  }
  return Buffer.from(raw.slice(0, 32), 'utf8')
}

export interface EncryptedPayload {
  encryptedValue: string
  iv: string
  authTag: string
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getMasterKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encryptedValue: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  }
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getMasterKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedValue, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

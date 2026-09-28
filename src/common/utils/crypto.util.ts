import * as crypto from 'crypto';

/**
 * AES-256-GCM Encryption / Decryption Utility for sensitive credentials (e.g. AI Provider API keys)
 */
export class CryptoUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

  private static getEncryptionKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM
   * Returns a single compact packed string format: "iv:authTag:ciphertext"
   */
  static encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.getEncryptionKey();
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
  }

  /**
   * Decrypts packed string ("iv:authTag:ciphertext") using AES-256-GCM
   */
  static decrypt(packedCiphertext: string): string {
    const parts = packedCiphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }
    const [ivHex, authTagHex, ciphertextHex] = parts;

    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// eslint-disable-next-line import/no-unresolved
import { describe, expect, it } from 'vitest';

// Import the crypto module from the global scope
const { crypto } = globalThis;

/**
 * Generate a random encryption key for AES-GCM
 *
 * @returns A Promise that resolves to a CryptoKey
 */
async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt data using AES-GCM
 *
 * @param data - The data to encrypt
 * @param key - The encryption key
 * @returns A Promise that resolves to an object containing the ciphertext and IV
 */
async function encryptWithAESGCM(
  data: string,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  // Generate a random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Convert the data to a buffer
  const dataBuffer = new TextEncoder().encode(data);

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    dataBuffer,
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
}

/**
 * Decrypt data using AES-GCM
 *
 * @param ciphertext - The encrypted data
 * @param iv - The IV used for encryption
 * @param key - The encryption key
 * @returns A Promise that resolves to the decrypted data as a string
 */
async function decryptWithAESGCM(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<string> {
  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertext,
  );

  // Convert the decrypted data to a string
  return new TextDecoder().decode(decrypted);
}

describe('Secure API Key Encryption with AES-GCM', () => {
  it('should generate an encryption key', async () => {
    const key = await generateEncryptionKey();

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('should encrypt data using AES-GCM', async () => {
    const key = await generateEncryptionKey();
    const data = 'api-key-123456';

    const { ciphertext, iv } = await encryptWithAESGCM(data, key);

    expect(ciphertext).toBeDefined();
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(iv).toBeDefined();
    expect(iv.length).toBe(12);
  });

  it('should decrypt data encrypted with AES-GCM', async () => {
    const key = await generateEncryptionKey();
    const data = 'api-key-123456';

    const { ciphertext, iv } = await encryptWithAESGCM(data, key);
    const decrypted = await decryptWithAESGCM(ciphertext, iv, key);

    expect(decrypted).toBe(data);
  });

  it('should fail to decrypt with an incorrect key', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const data = 'api-key-123456';

    const { ciphertext, iv } = await encryptWithAESGCM(data, key1);

    await expect(decryptWithAESGCM(ciphertext, iv, key2)).rejects.toThrow();
  });

  it('should fail to decrypt with an incorrect IV', async () => {
    const key = await generateEncryptionKey();
    const data = 'api-key-123456';

    const { ciphertext } = await encryptWithAESGCM(data, key);
    const wrongIv = crypto.getRandomValues(new Uint8Array(12));

    await expect(decryptWithAESGCM(ciphertext, wrongIv, key)).rejects.toThrow();
  });
});

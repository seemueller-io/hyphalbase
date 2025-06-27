/**
 * Secure API key encryption using AES-GCM
 *
 * This module provides functions for securely encrypting and decrypting API keys
 * using AES-GCM with a random IV for each encryption operation.
 */

/**
 * Generate a random encryption key for AES-GCM
 *
 * @returns A Promise that resolves to a CryptoKey
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
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
 * Export a CryptoKey to raw bytes
 *
 * @param key - The CryptoKey to export
 * @returns A Promise that resolves to the raw key bytes
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(rawKey);
}

/**
 * Import raw bytes as a CryptoKey
 *
 * @param keyData - The raw key bytes
 * @returns A Promise that resolves to a CryptoKey
 */
export async function importKey(keyData: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt an API key using AES-GCM
 *
 * @param apiKey - The API key to encrypt
 * @param encryptionKey - The encryption key
 * @returns A Promise that resolves to an object containing the ciphertext and IV
 */
export async function encryptApiKey(
  apiKey: string,
  encryptionKey: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  // Generate a random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Convert the API key to a buffer
  const apiKeyBuffer = new TextEncoder().encode(apiKey);

  // Encrypt the API key
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    apiKeyBuffer,
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  };
}

/**
 * Decrypt an API key using AES-GCM
 *
 * @param ciphertext - The encrypted API key
 * @param iv - The IV used for encryption
 * @param encryptionKey - The encryption key
 * @returns A Promise that resolves to the decrypted API key
 */
export async function decryptApiKey(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  encryptionKey: CryptoKey,
): Promise<string> {
  // Decrypt the API key
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    ciphertext,
  );

  // Convert the decrypted API key to a string
  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a secure random API key
 *
 * @param length - The length of the API key in bytes (default: 32)
 * @returns A string containing the API key in hexadecimal format
 */
export function generateApiKey(length: number = 32): string {
  const apiKeyBytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(apiKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

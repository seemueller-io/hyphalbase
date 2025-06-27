/**
 * Secure password hashing using PBKDF2
 *
 * This module provides functions for securely hashing and verifying passwords
 * using PBKDF2 with a high number of iterations and a random salt.
 */

/**
 * Hash a password using PBKDF2
 *
 * @param password - The password to hash
 * @param salt - Optional salt to use for hashing (if not provided, a random salt will be generated)
 * @returns An object containing the hash and salt
 */
export async function hashPasswordWithPBKDF2(
  password: string,
  salt?: Uint8Array,
): Promise<{ hash: string; salt: Uint8Array }> {
  // Generate a random salt if not provided
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  // Convert the password to a buffer
  const passwordBuffer = new TextEncoder().encode(password);

  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000, // High number of iterations for security
      hash: 'SHA-256',
    },
    passwordKey,
    256, // 256 bits output
  );

  // Convert the derived bits to a hex string
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return { hash: hashHex, salt };
}

/**
 * Verify a password against a hash
 *
 * @param password - The password to verify
 * @param hash - The hash to verify against
 * @param salt - The salt used to create the hash
 * @returns True if the password matches the hash, false otherwise
 */
export async function verifyPasswordWithPBKDF2(
  password: string,
  hash: string,
  salt: Uint8Array,
): Promise<boolean> {
  // Hash the password with the provided salt
  const result = await hashPasswordWithPBKDF2(password, salt);

  // Compare the hashes
  return result.hash === hash;
}

/**
 * Format for storing password hash and salt in the database
 *
 * The format is: pbkdf2$iterations$salt$hash
 * Where:
 * - pbkdf2 is the algorithm identifier
 * - iterations is the number of iterations used (100000)
 * - salt is the base64-encoded salt
 * - hash is the base64-encoded hash
 *
 * @param hash - The hash to format
 * @param salt - The salt used to create the hash
 * @returns A formatted string for storage
 */
export function formatPasswordHashForStorage(hash: string, salt: Uint8Array): string {
  const saltBase64 = Buffer.from(salt).toString('base64');
  return `pbkdf2$100000$${saltBase64}$${hash}`;
}

/**
 * Parse a formatted password hash from storage
 *
 * @param formattedHash - The formatted hash string from storage
 * @returns An object containing the hash and salt
 * @throws Error if the formatted hash is invalid
 */
export function parsePasswordHashFromStorage(formattedHash: string): {
  hash: string;
  salt: Uint8Array;
} {
  const parts = formattedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    throw new Error('Invalid password hash format');
  }

  const saltBase64 = parts[2];
  const hash = parts[3];
  const salt = Buffer.from(saltBase64, 'base64');

  return { hash, salt: new Uint8Array(salt) };
}

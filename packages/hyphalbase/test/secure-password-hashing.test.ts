// eslint-disable-next-line import/no-unresolved
import { describe, expect, it } from 'vitest';

// Import the crypto module from the global scope
const { crypto } = globalThis;

// Define a function to hash a password using PBKDF2
async function hashPasswordWithPBKDF2(
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

// Define a function to verify a password against a hash
async function verifyPasswordWithPBKDF2(
  password: string,
  hash: string,
  salt: Uint8Array,
): Promise<boolean> {
  // Hash the password with the provided salt
  const result = await hashPasswordWithPBKDF2(password, salt);

  // Compare the hashes
  return result.hash === hash;
}

describe('Secure Password Hashing with PBKDF2', () => {
  it('should hash a password using PBKDF2', async () => {
    const password = 'password123';
    const result = await hashPasswordWithPBKDF2(password);

    expect(result.hash).toBeDefined();
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.salt).toBeDefined();
    expect(result.salt.length).toBe(16);
  });

  it('should verify a password against its hash', async () => {
    const password = 'password123';
    const { hash, salt } = await hashPasswordWithPBKDF2(password);

    const isValid = await verifyPasswordWithPBKDF2(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const password = 'password123';
    const wrongPassword = 'wrongpassword';
    const { hash, salt } = await hashPasswordWithPBKDF2(password);

    const isValid = await verifyPasswordWithPBKDF2(wrongPassword, hash, salt);
    expect(isValid).toBe(false);
  });

  it('should generate different hashes for the same password with different salts', async () => {
    const password = 'password123';
    const result1 = await hashPasswordWithPBKDF2(password);
    const result2 = await hashPasswordWithPBKDF2(password);

    expect(result1.hash).not.toBe(result2.hash);
    expect(Buffer.from(result1.salt).toString('hex')).not.toBe(
      Buffer.from(result2.salt).toString('hex'),
    );
  });
});

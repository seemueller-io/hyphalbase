import { v4 as uuidv4 } from 'uuid';

import {
  generateEncryptionKey,
  exportKey,
  importKey,
  encryptApiKey,
  decryptApiKey,
  generateApiKey,
} from './secure-api-key-encryption';
import { verifyPasswordWithPBKDF2, hashPasswordWithPBKDF2 } from './secure-password-hashing';

export interface CreateUser {
  /** Optional UUID; server autogenerates if omitted */
  username: string;
  password: string;
}

export interface CreateUserResponse {
  id: string;
}

// --- Payload shapes ---
interface CreateUserPayload extends CreateUser {
  user_data: { [key: string]: unknown };
}

interface CreateUserApiKeyPayload {
  username: string;
  password: string;
}

interface CreateUserApiKeyResponse {
  apiKey: string;
}

interface ValidateUserApiKeyPayload {
  apiKey: string;
}

interface ValidateUserApiKeyResponse {
  isValid: boolean;
}

/**
 * Maps each operation to its payload and response types.
 * Used by the generic `request` method for end‑to‑end type‑safety.
 */
// This is the type that will be returned by the getAllUserKeys function
type UserKey = {
  id: string;
  user_id: string;
  key_ciphertext: string;
};

// The response type for the get_all_user_keys operation
type GetAllUserKeysResponse = UserKey[];

interface GetUserFromKeyPayload {
  apiKey: string;
}

interface GetUserFromKeyResponse {
  username?: string;
  user_data?: { [key: string]: unknown };
  error?: string;
}

interface OperationMap {
  create_user: { payload: CreateUserPayload; response: CreateUserResponse };
  create_api_key_for_user: { payload: CreateUserApiKeyPayload; response: CreateUserApiKeyResponse };
  validate_api_key: { payload: ValidateUserApiKeyPayload; response: ValidateUserApiKeyResponse };
  get_all_user_keys: { payload: Record<string, never>; response: GetAllUserKeysResponse };
  get_user_from_key: { payload: GetUserFromKeyPayload; response: GetUserFromKeyResponse };
}

function createUsersTable(sql: SqlStorage) {
  return sql.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id           TEXT PRIMARY KEY,              -- UUIDv4
          username     TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,                -- *never* store raw passwords
          password_salt BLOB,                         -- salt for PBKDF2 hashing
          user_data     TEXT, -- arbitrary place to put metadata about the user,
          created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`);
}

function createUsersKeysTable(sql: SqlStorage) {
  return sql.exec(`CREATE TABLE IF NOT EXISTS user_keys (
                              id              TEXT PRIMARY KEY,           -- UUID for the key itself
                              user_id         TEXT NOT NULL,
                              key_label       TEXT,                       -- “mobile-app”, “CI token”, etc.
                              key_ciphertext  BLOB NOT NULL,              -- encrypted bytes, not plain text
                              key_iv          BLOB NOT NULL,              -- AES-GCM IV used for this row
                              created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                              last_used_at    DATETIME,
                              revoked         INTEGER DEFAULT 0 CHECK (revoked IN (0,1)),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`);
}

type CreateUserArgs = {
  sql: SqlStorage;
  id: string;
  username: string;
  password_hash: string;
  password_salt: Uint8Array;
  user_data: string;
};

async function createUser(args: CreateUserArgs) {
  const { sql, id, username, password_hash, password_salt, user_data } = args;
  return sql.exec(
    `INSERT INTO users (id, username, password_hash, password_salt, user_data)
     VALUES (?, ?, ?, ?, ?)`,
    id,
    username,
    password_hash,
    Buffer.from(password_salt),
    user_data,
  );
}

async function validatePassword(
  password: string,
  password_hash: string,
  password_salt: Uint8Array,
): Promise<boolean> {
  // Use the PBKDF2 verification function
  return verifyPasswordWithPBKDF2(password, password_hash, password_salt);
}

function decodeRowToUser(row: any) {
  try {
    // Check if row is an array and get the first element if it is
    const userData = Array.isArray(row) ? row[0] : row;

    const { username, password_hash, password_salt, id, user_data } = userData;
    return {
      username,
      password_hash,
      password_salt: password_salt ? new Uint8Array(Buffer.from(password_salt)) : undefined,
      id,
      user_data,
    };
  } catch (error) {
    throw 'Failed to decode row to user\n' + error;
  }
}

async function getUser(username: string, sql: SqlStorage) {
  // Temporary: Get all users for debugging
  // const allUsers = sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM users');
  // console.log('All users:', allUsers.toArray());
  // console.log('Raw rows:', JSON.stringify(allUsers));

  const userQuery = sql.exec<Record<string, SqlStorageValue>>(
    `SELECT id, username, password_hash, password_salt, user_data
     FROM users
     WHERE username = ?`,
    username, // Pass the username parameter here
  );

  const user = userQuery.toArray().at(0);

  if (!user) {
    return null;
  }

  return user;
}

async function getAllUserKeys(sql: SqlStorage): Promise<UserKey[]> {
  // Get all keys from the database
  const allKeys = sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM user_keys');
  const keys = allKeys.toArray();

  // Transform the keys to the expected format
  return keys.map(key => ({
    id: key.id as string,
    user_id: key.user_id as string,
    key_ciphertext: Buffer.from(key.key_ciphertext as Buffer).toString('base64'),
  }));
}

async function validateApiKey(apiKey: string, sql: SqlStorage) {
  // Get all keys from the database
  const allKeys = sql.exec<Record<string, SqlStorageValue>>(
    `SELECT id,
          user_id,
          key_label,
          key_ciphertext,
          key_iv,
          created_at,
          last_used_at,
          revoked
   FROM user_keys
   WHERE revoked = 0`,
  );
  const keys = allKeys.toArray();

  // We need to check each key by decrypting it
  for (const key of keys) {
    try {
      const keyId = key.id as string;
      const ciphertext = key.key_ciphertext as Buffer;
      const iv = key.key_iv as Buffer;

      // Get the encryption key from the global variable
      // @ts-expect-error - global.__encryptionKeys is not defined in the type system
      const encryptionKeyBytes = global.__encryptionKeys?.[keyId];
      if (!encryptionKeyBytes) {
        continue;
      }

      // Import the encryption key
      const encryptionKey = await importKey(encryptionKeyBytes);

      // Decrypt the API key
      const decryptedApiKey = await decryptApiKey(
        new Uint8Array(ciphertext),
        new Uint8Array(iv),
        encryptionKey,
      );

      // Compare the decrypted API key with the provided API key
      if (decryptedApiKey === apiKey) {
        // Update the last_used_at timestamp
        sql.exec(
          `UPDATE user_keys
           SET last_used_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          keyId,
        );

        return true;
      }
    } catch (error) {
      continue;
    }
  }

  return false;
}

async function createApiKeyForUser(id: any, sql: SqlStorage): Promise<string> {
  // Generate a random API key
  const apiKey = generateApiKey();

  // Generate an encryption key
  const encryptionKey = await generateEncryptionKey();

  // Encrypt the API key
  const { ciphertext, iv } = await encryptApiKey(apiKey, encryptionKey);

  // Export the encryption key to raw bytes for storage
  const encryptionKeyBytes = await exportKey(encryptionKey);

  // Store the encrypted key in the database
  const keyId = uuidv4();
  sql.exec(
    `INSERT INTO user_keys (id, user_id, key_ciphertext, key_iv)
     VALUES (?, ?, ?, ?)`,
    keyId,
    id,
    Buffer.from(ciphertext),
    Buffer.from(iv),
  );

  // We need to store the encryption key securely
  // For now, we'll store it in a global variable, but in a production environment,
  // it should be stored in a secure key management service
  // @ts-expect-error - global.__encryptionKeys is not defined in the type system
  if (!global.__encryptionKeys) {
    // @ts-expect-error - global.__encryptionKeys is not defined in the type system
    global.__encryptionKeys = {};
  }
  // @ts-expect-error - global.__encryptionKeys is not defined in the type system
  global.__encryptionKeys[keyId] = encryptionKeyBytes;

  return apiKey;
}

export class Gateway {
  private user?: { username: string; id: string; user_data: any };
  constructor(private sql: SqlStorage) {
    if (sql) {
      createUsersTable(sql);
      createUsersKeysTable(sql);
    }
  }

  getUser() {
    return this.user;
  }

  private async query<Op extends keyof OperationMap>(
    operation: Op,
    payload: OperationMap[Op]['payload'],
  ): Promise<OperationMap[Op]['response']> {
    return this.execute(operation, payload);
  }

  async execute<Op extends keyof OperationMap>(
    operation: Op,
    payload: OperationMap[keyof OperationMap]['payload'],
  ): Promise<OperationMap[Op]['response']> {
    switch (operation) {
      case 'create_user': {
        const { username, password, user_data } = payload as CreateUserPayload;

        const id: string = uuidv4();

        // Hash the password using PBKDF2
        const { hash: password_hash, salt: password_salt } = await hashPasswordWithPBKDF2(password);

        const result = await createUser({
          id,
          username,
          password_hash,
          password_salt,
          user_data: JSON.stringify(user_data ?? {}),
          sql: this.sql,
        });

        return { id };
      }
      case 'create_api_key_for_user': {
        const { username, password } = payload as CreateUserApiKeyPayload;

        const row = await getUser(username, this.sql);
        if (!row) {
          return { message: 'User not found' };
        }

        const user = decodeRowToUser(row);

        if (!user) {
          return { message: 'User not found' };
        }

        // Check if password_salt is available (for backward compatibility)
        if (!user.password_salt) {
          return { message: 'Bad credentials' };
        }

        if (!(await validatePassword(password, user.password_hash, user.password_salt))) {
          return { message: 'Bad credentials' };
        }

        const apiKey = await createApiKeyForUser(user.id, this.sql);
        return { apiKey } as CreateUserApiKeyResponse;
      }
      case 'validate_api_key': {
        const { apiKey } = payload as ValidateUserApiKeyPayload;
        const isValid = await validateApiKey(apiKey, this.sql);
        return { isValid };
      }

      case 'get_all_user_keys': {
        return await getAllUserKeys(this.sql);
      }
      case 'get_user_from_key':
        return await this.getUserFromApiKey(payload);
      default:
        return { message: 'Invalid operation' };
    }
  }

  private async getUserFromApiKey(
    payload:
      | CreateUserPayload
      | CreateUserApiKeyPayload
      | ValidateUserApiKeyPayload
      | Record<string, never>
      | GetUserFromKeyPayload,
  ) {
    {
      const { apiKey } = payload as GetUserFromKeyPayload;
      const allKeys = this.sql.exec<Record<string, SqlStorageValue>>(
        `SELECT uk.*, u.username, u.user_data
           FROM user_keys uk
           JOIN users u ON uk.user_id = u.id
           WHERE uk.revoked = 0`,
      );
      const keys = allKeys.toArray();

      for (const key of keys) {
        try {
          const keyId = key.id as string;
          const ciphertext = key.key_ciphertext as Buffer;
          const iv = key.key_iv as Buffer;

          // @ts-expect-error - global.__encryptionKeys is not defined in the type system
          const encryptionKeyBytes = global.__encryptionKeys?.[keyId];
          if (!encryptionKeyBytes) {
            continue;
          }

          const encryptionKey = await importKey(encryptionKeyBytes);
          const decryptedApiKey = await decryptApiKey(
            new Uint8Array(ciphertext),
            new Uint8Array(iv),
            encryptionKey,
          );

          if (decryptedApiKey === apiKey) {
            const user = {
              username: key.username as string,
              id: key.user_id as string,
              user_data: JSON.parse(key.user_data as string),
            };
            this.user = user;
            return user;
          }
        } catch (error) {
          continue;
        }
      }
      return { error: 'Invalid API key' };
    }
  }
}

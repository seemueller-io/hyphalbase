import { v4 as uuidv4 } from 'uuid';

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

interface OperationMap {
  create_user: { payload: CreateUserPayload; response: CreateUserResponse };
  create_api_key_for_user: { payload: CreateUserApiKeyPayload; response: CreateUserApiKeyResponse };
  validate_api_key: { payload: ValidateUserApiKeyPayload; response: ValidateUserApiKeyResponse };
  get_all_user_keys: { payload: Record<string, never>; response: GetAllUserKeysResponse };
}

function createUsersTable(sql: SqlStorage) {
  return sql.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id           TEXT PRIMARY KEY,              -- UUIDv4
          username     TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,                -- *never* store raw passwords
          user_data     TEXT -- arbitrary place to put metadata about the user,
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
  user_data: string;
};

async function createUser(args: CreateUserArgs) {
  const { sql, id, username, password_hash, user_data } = args;
  return sql.exec(
    `INSERT INTO users (id, username, password_hash, user_data)
     VALUES (?, ?, ?, ?)`,
    id,
    username,
    password_hash,
    user_data,
  );
}

async function validatePassword(password: string, password_hash: string): Promise<boolean> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)).then(hash => {
    const hash_str = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hash_str === password_hash;
  });
}

function decodeRowToUser(row: any) {
  try {
    // Check if row is an array and get the first element if it is
    const userData = Array.isArray(row) ? row[0] : row;

    const { username, password_hash, id, user_data } = userData;
    return { username, password_hash, id, user_data };
  } catch (error) {
    throw 'Failed to decode row to vector\n' + error;
  }
}

function decodeRowToUserKey(row: any) {
  try {
    const { id, user_id, key_label, key_ciphertext, key_iv, created_at, last_used_at, revoked } =
      row;
    return { id, user_id, key_label, key_ciphertext, key_iv, created_at, last_used_at, revoked };
  } catch (error) {
    throw 'Failed to decode row to vector\n' + error;
  }
}

async function getUser(username: string, sql: SqlStorage) {
  // Temporary: Get all users for debugging
  // const allUsers = sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM users');
  // console.log('All users:', allUsers.toArray());
  // console.log('Raw rows:', JSON.stringify(allUsers));

  console.log({ username });
  const userQuery = sql.exec<Record<string, SqlStorageValue>>(
    `SELECT id, username, password_hash, user_data
     FROM users
     WHERE username = ?`,
    username, // Pass the username parameter here
  );

  const user = userQuery.toArray().at(0);

  console.log({ user });

  if (!user) {
    return null;
  }

  return user;
}

async function getAllUserKeys(sql: SqlStorage): Promise<UserKey[]> {
  console.log('Getting all user keys...');

  // Get all keys from the database
  const allKeys = sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM user_keys');
  const keys = allKeys.toArray();

  console.log('All keys:', keys);

  // Transform the keys to the expected format
  return keys.map(key => ({
    id: key.id as string,
    user_id: key.user_id as string,
    key_ciphertext: Buffer.from(key.key_ciphertext as Buffer).toString('base64'),
  }));
}

async function validateApiKey(apiKey: string, sql: SqlStorage) {
  console.log('Validating API key...');

  // Get all keys from the database
  const allKeys = sql.exec<Record<string, SqlStorageValue>>('SELECT * FROM user_keys');
  const keys = allKeys.toArray();

  console.log('All keys:', keys);

  // We need to check each key by decrypting it
  // Note: This approach requires storing the encryption key, which we're not doing
  // For now, let's use a different approach - store a hash of the API key instead

  // Hash the provided API key
  const apiKeyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  const apiKeyHashArray = new Uint8Array(apiKeyHash);

  console.log(
    'API key hash:',
    Array.from(apiKeyHashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  );

  // Query for the hashed key
  const userApiKeyQuery = sql.exec<Record<string, SqlStorageValue>>(
    `SELECT id,
          user_id,
          key_label,
          key_ciphertext,
          key_iv,
          created_at,
          last_used_at,
          revoked
   FROM user_keys
   WHERE key_ciphertext = ?`,
    Buffer.from(apiKeyHashArray),
  );

  const userKeyRow = userApiKeyQuery.toArray().at(0);
  console.log('Query result:', { userKeyRow });

  if (!userKeyRow) {
    console.log('No matching row found');
    return false;
  }

  // If we found a match, the API key is valid
  console.log('API key is valid');
  return true;
}

async function createApiKeyForUser(id: any, sql: SqlStorage): Promise<string> {
  // Generate a random API key
  const apiKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const apiKey = Array.from(apiKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Hash the API key instead of encrypting it
  const apiKeyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  const apiKeyHashArray = new Uint8Array(apiKeyHash);

  // Generate a dummy IV for consistency with the schema
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Store the hashed key in the database
  const keyId = uuidv4();
  sql.exec(
    `INSERT INTO user_keys (id, user_id, key_ciphertext, key_iv)
     VALUES (?, ?, ?, ?)`,
    keyId,
    id,
    Buffer.from(apiKeyHashArray),
    iv,
  );

  return apiKey;
}

export class Gateway {
  constructor(private sql: SqlStorage) {
    if (sql) {
      createUsersTable(sql);
      createUsersKeysTable(sql);
    }
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

        const password_hash = await crypto.subtle
          .digest('SHA-256', new TextEncoder().encode(password))
          .then(hash => {
            return Array.from(new Uint8Array(hash))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          });

        console.log({ password_hash });

        const result = await createUser({
          id,
          username,
          password_hash,
          user_data: JSON.stringify(user_data ?? {}),
          sql: this.sql,
        });

        console.log({ result: result.toArray() });

        return { id };
      }
      case 'create_api_key_for_user': {
        const { username, password } = payload as CreateUserApiKeyPayload;

        const row = await getUser(username, this.sql);
        if (!row) {
          return { message: 'User not found' };
        }

        console.log({ row: JSON.stringify(row) });

        const user = decodeRowToUser(row);

        console.log({ user: JSON.stringify(user) });

        if (!user) {
          return { message: 'User not found' };
        }

        if (!(await validatePassword(password, user.password_hash))) {
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
      default:
        return { message: 'Invalid operation' };
    }
  }
}

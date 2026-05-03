export interface EncryptedValue {
    ciphertext: string;
    iv: string;
    authTag: string;
}
export declare function encrypt(plaintext: string): EncryptedValue;
export declare function decrypt(encrypted: EncryptedValue): string;
/**
 * Rotate the master encryption key.
 * Decrypts all rows in project_env_vars and user_env_vars with the current
 * ENCRYPTION_KEY, re-encrypts with newKeyHex, and commits atomically.
 *
 * After this completes, update ENCRYPTION_KEY in Coolify to newKeyHex.
 *
 * @returns number of rows re-encrypted
 */
export declare function rotateKey(db: import('better-sqlite3').Database, newKeyHex: string): number;
export declare function isEncryptionAvailable(): boolean;
/**
 * Verify encryption is usable: key set, correct length, and able to
 * encrypt+decrypt a sentinel. Throws with a clear actionable message if not.
 */
export declare function assertEncryptionUsable(): void;
//# sourceMappingURL=crypto.d.ts.map
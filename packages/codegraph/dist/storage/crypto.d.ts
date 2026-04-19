/**
 * AES-256-GCM encryption wrapper for env vars.
 *
 * Master key from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Each value gets a unique random IV (12 bytes).
 * Output: { ciphertext, iv, authTag } all base64-encoded.
 */
export interface EncryptedValue {
    ciphertext: string;
    iv: string;
    authTag: string;
}
export declare function encrypt(plaintext: string): EncryptedValue;
export declare function decrypt(encrypted: EncryptedValue): string;
export declare function isEncryptionAvailable(): boolean;
/**
 * Verify encryption is usable: key set, correct length, and able to
 * encrypt+decrypt a sentinel. Throws with a clear actionable message if not.
 */
export declare function assertEncryptionUsable(): void;
//# sourceMappingURL=crypto.d.ts.map
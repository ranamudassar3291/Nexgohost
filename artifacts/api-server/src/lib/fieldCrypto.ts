/**
 * AES-256-GCM field-level encryption for sensitive DB values.
 *
 * Encrypted fields are stored as: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * If ENCRYPTION_KEY is not set, the field is stored/returned as-is (plaintext fallback
 * for development — production MUST set ENCRYPTION_KEY).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env["ENCRYPTION_KEY"];
  if (!raw) return null;
  const hex = raw.replace(/\s/g, "");
  if (hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptField(ciphertext: string): string {
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;
  const key = getKey();
  if (!key) return ciphertext;

  const parts = ciphertext.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return ciphertext;
  const [ivHex, tagHex, encHex] = parts;

  try {
    const iv = Buffer.from(ivHex!, "hex");
    const authTag = Buffer.from(tagHex!, "hex");
    const encrypted = Buffer.from(encHex!, "hex");

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return ciphertext;
  }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

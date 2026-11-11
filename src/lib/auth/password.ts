// src/lib/auth/password.ts
// Xử lý mã hóa và so khớp mật khẩu bằng bcrypt (kèm fallback sha256 cho seed data)

import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const SALT_ROUNDS = 10;

/** Hash mật khẩu bằng bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Kiểm tra mật khẩu */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // 1. Kiểm tra bằng bcrypt
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash);
  }

  // 2. Fallback cho mật khẩu tạo bằng SHA-256 từ seed
  const sha256Hash = createHash("sha256").update(password).digest("hex");
  return sha256Hash === hash;
}

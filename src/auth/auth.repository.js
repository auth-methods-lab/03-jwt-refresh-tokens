import postgresManager from "../database/postgres.manager.js";

export default class AuthRepository {

  static async findUserByEmail(email) {
    const result = await postgresManager.sql`SELECT id,email,password_hash FROM users WHERE email = ${email}`;
    return result[0] ?? null;
  }

  static async createUser(email, passwordHash) {
    const result = await postgresManager.sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id, email, created_at
    `;
    return result[0];
  }

  static async createRefreshToken({ userId, tokenHash, expiresAt, userAgent, ipAddress }) {
    await postgresManager.sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
      VALUES (${userId}, ${tokenHash}, ${expiresAt}, ${userAgent}, ${ipAddress})
    `;
  }

  static async findRefreshToken(tokenHash) {
    const result = await postgresManager.sql`
      SELECT id, user_id, token_hash, expires_at
      FROM refresh_tokens
      WHERE token_hash = ${tokenHash}  AND expires_at > NOW()
    `;
    return result[0] ?? null;
  }

  static async deleteRefreshToken(tokenHash) {
    await postgresManager.sql`
      DELETE FROM refresh_tokens
      WHERE token_hash = ${tokenHash}
    `;
  }

  static async deleteAllRefreshTokensByUserId(userId) {
    await postgresManager.sql`
      DELETE FROM refresh_tokens
      WHERE user_id = ${userId}
    `;
  }

  // Limpieza periódica de tokens expirados (cron job o llamada manual)
  static async deleteExpiredRefreshTokens() {
    await postgresManager.sql`
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW()
    `;
  }
}

import postgresManager from "../database/postgres.manager";

export default class AuthRepository {

  static async findUserByEmail(email) {
    const result = await postgresManager`SELECT id,email,password_hash FROM users WHERE email = ${email}`;
    return result.length === 1 ? result[0] : null;
  }

  static async createUser(email, password) {

  }
}

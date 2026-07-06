import PostgresManager from '../database/postgres.manager.js';
import RedisManager from '../database/redis.manager.js';

export default class HealthRepository {

  static async checkPostgresServer() {
    const result = await PostgresManager.sql`SELECT 1`;
    return result.length === 1;
  }

  static async checkRedisServer() {
    const result = await RedisManager.client.ping();
    return result === 'PONG';
  }

}

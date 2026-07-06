// src/database/redis.manager.js
import { createClient } from "redis";

class RedisManager {
  static #instance = null;
  #client = null;

  constructor() {
    this.#client = createClient({
      socket: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: process.env.REDIS_PORT ?? 6379,
      }
    });

    this.#client.on("error", (err) => {
      console.error("[RedisManager] Error:", err.message);
    });
  }

  get client() {
    return this.#client;
  }

  async connect() {
    await this.#client.connect();
    console.log("[RedisManager] Conexión a Redis establecida");
  }

  async disconnect() {
    try {
      await this.#client.disconnect();
      console.log("[RedisManager] Conexión a Redis cerrada");
    } catch (error) {
      console.error("[RedisManager] Error al cerrar la conexión:", error.message);
      throw error;
    }
  }
}

export default new RedisManager();

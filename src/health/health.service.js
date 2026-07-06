import HealthRepository from "./health.repository.js";

export default class HealthService {
  static async checkHttpServer() {
    return { status: "ok" };
  }

  static async checkPostgresServer() {
    return await HealthRepository.checkPostgresServer();
  }

  static async checkRedisServer() {
    return await HealthRepository.checkRedisServer();
  }
}

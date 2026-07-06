import HealthService from "./health.service.js";

export default class HealthController {
  static async getHealthCheck(req, res) {
    try {
      const postgresHealthResult = await HealthService.checkPostgresServer();
      const redisHealthResult = await HealthService.checkRedisServer();
      res.status(200).json({ httpServer: "ok", postgresServer: postgresHealthResult, redisServer: redisHealthResult });

    } catch (error) {
      console.log('Error in getHealthCheck', error);
      res.status(500).json({ status: 'ko', message: 'No se ha podio establecer conexión conla base de datos de redis.' });
    }
  }

}

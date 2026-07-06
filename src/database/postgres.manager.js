import postgres from 'postgres'

class PostgresManager {
  static #instance = null
  #sql = null

  constructor() {
    this.#sql = postgres({
      host: process.env.DB_HOST ?? 'localhost',
      port: process.env.DB_PORT ?? 5432,
      database: process.env.DB_NAME ?? 'database_name',
      email: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      max: process.env.DB_POOL_MAX ?? 10,
      idle_timeout: process.env.DB_IDLE_TIMEOUT ?? 30,
      connect_timeout: process.env.DB_CONNECT_TIMEOUT ?? 10,
      transform: postgres.camel,
      onnotice: process.env.NODE_ENV === 'production' ? () => { } : undefined,
    })
  }

  get sql() {
    return this.#sql
  }

  async connect() {
    try {
      await this.#sql`SELECT 1`
      console.log('[PostgresManager] Conexión a PostgreSQL establecida')
    } catch (error) {
      console.error('[PostgresManager] Error al conectar con PostgreSQL:', error.message)
      throw error
    }
  }

  async disconnect() {
    try {
      await this.#sql.end()
      console.log('[PostgresManager] Conexión a PostgreSQL cerrada')
    } catch (error) {
      console.error('[PostgresManager] Error al cerrar la conexión:', error.message)
      throw error
    }
  }
}

export default new PostgresManager()

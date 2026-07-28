import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, PoolConfig } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private pool: Pool;
  public db: NodePgDatabase;

  constructor(private readonly configService: ConfigService) {
    const poolConfig: PoolConfig = {
      connectionString: this.configService.get<string>("app.databaseUrl"),
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    this.pool = new Pool(poolConfig);
    this.db = drizzle(this.pool);
  }

  async onModuleInit() {
    try {
      const client = await this.pool.connect();
      client.release();
      this.logger.log(
        `Database connected (pool: min=${this.pool.options.min}, max=${this.pool.options.max})`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to connect to database on startup (will retry on first query)",
        error,
      );
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log("Database pool closed");
  }

  getPool(): Pool {
    return this.pool;
  }
}

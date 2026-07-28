import { Global, Module } from "@nestjs/common";
import { DrizzleService } from "./drizzle.service";

export const DRIZZLE = Symbol("DRIZZLE");

@Global()
@Module({
  providers: [
    DrizzleService,
    {
      provide: DRIZZLE,
      useFactory: (drizzleService: DrizzleService) => drizzleService.db,
      inject: [DrizzleService],
    },
  ],
  exports: [DRIZZLE, DrizzleService],
})
export class DrizzleModule {}

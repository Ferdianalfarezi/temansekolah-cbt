import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: "cbt-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health/live")
  liveness() {
    return { status: "ok" };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SiswaAccountService } from "./siswa-account.service";

/**
 * Cron job that runs daily at 2 AM to sync siswa accounts
 * from the LMS for all active tenants.
 */
@Injectable()
export class SiswaAccountCron {
  private readonly logger = new Logger(SiswaAccountCron.name);

  constructor(private readonly siswaAccountService: SiswaAccountService) {}

  @Cron("0 2 * * *")
  async handleDailySync(): Promise<void> {
    this.logger.log("Starting daily siswa account sync for all tenants...");

    try {
      const results = await this.siswaAccountService.syncAllTenants();

      const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
      const totalUpdated = results.reduce((sum, r) => sum + r.nisnUpdated, 0);
      const totalDeactivated = results.reduce(
        (sum, r) => sum + r.deactivated,
        0,
      );
      const totalFlagged = results.reduce(
        (sum, r) => sum + r.flaggedForReview,
        0,
      );
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      this.logger.log(
        `Daily sync completed: ${results.length} tenants processed. ` +
          `Created: ${totalCreated}, NISN updated: ${totalUpdated}, ` +
          `Deactivated: ${totalDeactivated}, Flagged: ${totalFlagged}, ` +
          `Errors: ${totalErrors}`,
      );
    } catch (error) {
      this.logger.error("Daily siswa account sync failed", error);
    }
  }
}

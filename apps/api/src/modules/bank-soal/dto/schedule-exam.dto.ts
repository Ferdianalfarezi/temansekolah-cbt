import { IsDateString, IsOptional, IsUUID } from "class-validator";

/**
 * DTO for scheduling exams from a Bank Soal
 *
 * Creates exam sessions for ALL target kelas in the bank soal automatically.
 * No need to select kelas manually - they are derived from cbt_bank_soal_kelas.
 */
export class ScheduleExamDto {
  /**
   * Scheduled date and time for the exam.
   * All exam sessions will share the same scheduled time.
   */
  @IsDateString()
  scheduledAt!: string;

  /**
   * Optional proctor ID. Defaults to current user if not provided.
   * The same proctor will be assigned to all created sessions.
   */
  @IsOptional()
  @IsUUID()
  proctorId?: string;
}

import { IsDateString, IsOptional, IsUUID } from "class-validator";

/**
 * DTO for scheduling an exam from a Bank Soal
 *
 * _Requirements: 7.1_
 */
export class ScheduleExamDto {
  /**
   * Scheduled date and time for the exam
   */
  @IsDateString()
  scheduledAt!: string;

  /**
   * Target kelas for the exam session.
   * Must be one of the target kelas from the bank soal (cbt_bank_soal_kelas).
   */
  @IsUUID()
  kelasId!: string;

  /**
   * Optional proctor ID. Defaults to current user if not provided.
   */
  @IsOptional()
  @IsUUID()
  proctorId?: string;
}

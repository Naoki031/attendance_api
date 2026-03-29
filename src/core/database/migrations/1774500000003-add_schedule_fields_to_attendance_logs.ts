import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddScheduleFieldsToAttendanceLogs1774500000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_logs' AND COLUMN_NAME = 'scheduled_start'`,
    )
    if (existing.length === 0) {
      await queryRunner.query(`
        ALTER TABLE attendance_logs
          ADD COLUMN scheduled_start   TIME NULL DEFAULT NULL COMMENT 'Effective work start time for this user on this day' AFTER clock_out,
          ADD COLUMN scheduled_end     TIME NULL DEFAULT NULL COMMENT 'Effective work end time for this user on this day' AFTER scheduled_start,
          ADD COLUMN schedule_type     ENUM('company','custom') NULL DEFAULT NULL COMMENT 'Source of scheduled time' AFTER scheduled_end,
          ADD COLUMN attendance_count  TINYINT NOT NULL DEFAULT 0 COMMENT '1 if any clock event exists, 0 otherwise' AFTER schedule_type
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_logs
        DROP COLUMN IF EXISTS scheduled_start,
        DROP COLUMN IF EXISTS scheduled_end,
        DROP COLUMN IF EXISTS schedule_type,
        DROP COLUMN IF EXISTS attendance_count
    `)
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkScheduleToCompanies1774500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'work_start_time'`,
    )
    if (columns.length === 0) {
      await queryRunner.query(
        `ALTER TABLE companies
         ADD COLUMN work_start_time TIME NULL DEFAULT NULL COMMENT 'Default work start time for this company',
         ADD COLUMN work_end_time TIME NULL DEFAULT NULL COMMENT 'Default work end time for this company'`,
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE companies
       DROP COLUMN IF EXISTS work_start_time,
       DROP COLUMN IF EXISTS work_end_time`,
    )
  }
}

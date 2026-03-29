import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddGoogleCalendarIdToCompanies1774600000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'google_calendar_id'`,
    )
    if (existing.length === 0) {
      await queryRunner.query(`
        ALTER TABLE companies
          ADD COLUMN google_calendar_id VARCHAR(255) NULL DEFAULT NULL
            COMMENT 'Google Calendar ID for this company (e.g. xxx@group.calendar.google.com)'
            AFTER allowed_ips
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE companies
        DROP COLUMN IF EXISTS google_calendar_id
    `)
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCalendarEventIdToEmployeeRequests1774600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_requests' AND COLUMN_NAME = 'calendar_event_id'`,
    )
    if (existing.length === 0) {
      await queryRunner.query(`
        ALTER TABLE employee_requests
          ADD COLUMN calendar_event_id VARCHAR(255) NULL DEFAULT NULL
            COMMENT 'Google Calendar event ID for deletion on rejection'
            AFTER sheet_row_index
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employee_requests
        DROP COLUMN IF EXISTS calendar_event_id
    `)
  }
}

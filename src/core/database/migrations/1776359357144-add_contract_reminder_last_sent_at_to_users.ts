import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddContractReminderLastSentAtToUsers1776359357144 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'contract_reminder_last_sent_at'
    `)
    if ((columns as unknown[]).length === 0) {
      await queryRunner.query(`
        ALTER TABLE users
          ADD COLUMN contract_reminder_last_sent_at DATE NULL
          COMMENT 'Date when last contract expiry reminder was sent to company admins'
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'contract_reminder_last_sent_at'
    `)
    if ((columns as unknown[]).length > 0) {
      await queryRunner.query(`
        ALTER TABLE users DROP COLUMN contract_reminder_last_sent_at
      `)
    }
  }
}

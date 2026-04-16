import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddContractExpiryReminderDaysToUsers1776357304865 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnExists = await queryRunner.query(`
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'contract_expiry_reminder_days'
    `)
    if (columnExists[0].count === '0') {
      await queryRunner.query(`
        ALTER TABLE users
        ADD COLUMN contract_expiry_reminder_days INT NOT NULL DEFAULT 30
          COMMENT 'Days before contract expiry to send reminder notification and email'
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS contract_expiry_reminder_days
    `)
  }
}

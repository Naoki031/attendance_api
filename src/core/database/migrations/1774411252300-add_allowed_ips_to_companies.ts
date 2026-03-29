import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAllowedIpsToCompanies1774411252300 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = await queryRunner.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'allowed_ips'`,
    )
    if (columns.length === 0) {
      await queryRunner.query(
        `ALTER TABLE companies ADD COLUMN allowed_ips TEXT NULL DEFAULT NULL COMMENT 'Comma-separated IPs or prefixes allowed to clock in/out via QR'`,
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE companies DROP COLUMN IF EXISTS allowed_ips`)
  }
}

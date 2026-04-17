import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterErrorLogsAddDedupFields1777100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE error_logs
        ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64) NULL AFTER id,
        ADD COLUMN IF NOT EXISTS occurrence_count INT NOT NULL DEFAULT 1 AFTER user_agent,
        ADD COLUMN IF NOT EXISTS last_occurred_at TIMESTAMP NULL AFTER occurrence_count
    `)

    // Unique index on fingerprint — NULL values are allowed to be non-unique in MariaDB
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_error_logs_fingerprint
        ON error_logs (fingerprint)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS UQ_error_logs_fingerprint ON error_logs
    `)

    await queryRunner.query(`
      ALTER TABLE error_logs
        DROP COLUMN IF EXISTS last_occurred_at,
        DROP COLUMN IF EXISTS occurrence_count,
        DROP COLUMN IF EXISTS fingerprint
    `)
  }
}

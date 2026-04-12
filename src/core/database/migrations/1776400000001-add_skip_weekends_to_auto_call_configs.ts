import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSkipWeekendsToAutoCallConfigs1776400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meeting_auto_call_configs
      ADD COLUMN skip_weekends TINYINT(1) NOT NULL DEFAULT 0
        AFTER is_enabled
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meeting_auto_call_configs
      DROP COLUMN skip_weekends
    `)
  }
}

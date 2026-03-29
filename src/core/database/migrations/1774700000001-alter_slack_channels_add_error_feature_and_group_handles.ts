import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterSlackChannelsAddErrorFeatureAndGroupHandles1774700000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE slack_channels
      ADD COLUMN mention_slack_group_handles JSON NULL
        COMMENT 'Slack group handles to mention, e.g. ["here","channel"] or subteam IDs like ["S1234567"]',
      MODIFY COLUMN feature ENUM('wfh','off','equipment','clock_forget','overtime','error') NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE slack_channels
      DROP COLUMN mention_slack_group_handles,
      MODIFY COLUMN feature ENUM('wfh','off','equipment','clock_forget','overtime') NOT NULL
    `)
  }
}

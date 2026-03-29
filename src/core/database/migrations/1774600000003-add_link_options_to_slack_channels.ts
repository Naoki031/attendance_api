import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLinkOptionsToSlackChannels1774600000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE slack_channels
      ADD COLUMN include_approval_link TINYINT(1) NOT NULL DEFAULT 0,
      ADD COLUMN include_my_requests_link TINYINT(1) NOT NULL DEFAULT 0
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE slack_channels
      DROP COLUMN include_approval_link,
      DROP COLUMN include_my_requests_link
    `)
  }
}

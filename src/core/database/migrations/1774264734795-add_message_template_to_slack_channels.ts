import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMessageTemplateToSlackChannels1774264734795 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`slack_channels\` ADD COLUMN \`message_template\` TEXT NULL AFTER \`mention_user_ids\``,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`slack_channels\` DROP COLUMN \`message_template\``)
  }
}

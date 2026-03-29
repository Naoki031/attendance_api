import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterSlackChannelsAddMentionUserIds1774154436159 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE slack_channels ADD COLUMN mention_user_ids JSON NULL AFTER feature`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE slack_channels DROP COLUMN mention_user_ids`)
  }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterSlackChannelsAddChannelId1742600000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'slack_channels',
      new TableColumn({
        name: 'channel_id',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Slack channel ID (e.g. C01234567) used for API-based messaging',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('slack_channels', 'channel_id')
  }
}

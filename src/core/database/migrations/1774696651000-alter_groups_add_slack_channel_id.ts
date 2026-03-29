import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterGroupsAddSlackChannelId1774696651000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'groups',
      new TableColumn({
        name: 'slack_channel_id',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('groups', 'slack_channel_id')
  }
}

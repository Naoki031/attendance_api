import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterMeetingsAddMeetingType1775328959583 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('meetings', 'meeting_type')) return

    await queryRunner.addColumn(
      'meetings',
      new TableColumn({
        name: 'meeting_type',
        type: 'enum',
        enum: ['one_time', 'recurring'],
        default: "'one_time'",
        isNullable: false,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('meetings', 'meeting_type')
  }
}

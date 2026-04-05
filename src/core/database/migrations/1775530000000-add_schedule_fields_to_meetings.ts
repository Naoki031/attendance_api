import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddScheduleFieldsToMeetings1775530000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('meetings', 'schedule_time')) return

    // Extend meeting_type enum to include daily and weekly schedule types
    await queryRunner.query(`
      ALTER TABLE meetings
      MODIFY COLUMN meeting_type ENUM('one_time','recurring','daily','weekly') NOT NULL DEFAULT 'one_time'
    `)

    // Add schedule_time: stores HH:mm time for daily and weekly meetings
    await queryRunner.addColumn(
      'meetings',
      new TableColumn({
        name: 'schedule_time',
        type: 'varchar',
        length: '5',
        isNullable: true,
      }),
    )

    // Add schedule_day_of_week: 0=Sunday ... 6=Saturday (weekly meetings only)
    await queryRunner.addColumn(
      'meetings',
      new TableColumn({
        name: 'schedule_day_of_week',
        type: 'tinyint',
        isNullable: true,
      }),
    )

    // Add schedule_interval_weeks: recurrence interval 1–4 weeks (weekly meetings only)
    await queryRunner.addColumn(
      'meetings',
      new TableColumn({
        name: 'schedule_interval_weeks',
        type: 'tinyint',
        isNullable: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('meetings', 'schedule_interval_weeks')
    await queryRunner.dropColumn('meetings', 'schedule_day_of_week')
    await queryRunner.dropColumn('meetings', 'schedule_time')

    await queryRunner.query(`
      ALTER TABLE meetings
      MODIFY COLUMN meeting_type ENUM('one_time','recurring') NOT NULL DEFAULT 'one_time'
    `)
  }
}

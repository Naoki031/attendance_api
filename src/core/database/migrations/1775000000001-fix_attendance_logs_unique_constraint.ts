import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

export class FixAttendanceLogsUniqueConstraint1775000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Merge duplicate (user_id, date) rows — keep earliest clock_in, latest clock_out
    await queryRunner.query(`
      UPDATE attendance_logs al
      INNER JOIN (
        SELECT
          MIN(id)       AS keep_id,
          user_id,
          date,
          MIN(clock_in)  AS best_clock_in,
          MAX(clock_out) AS best_clock_out
        FROM attendance_logs
        GROUP BY user_id, date
        HAVING COUNT(*) > 1
      ) merged ON al.id = merged.keep_id
      SET
        al.clock_in  = merged.best_clock_in,
        al.clock_out = merged.best_clock_out
    `)

    // Step 2: Delete the duplicate rows, keeping the MIN id per (user_id, date)
    await queryRunner.query(`
      DELETE al FROM attendance_logs al
      INNER JOIN (
        SELECT user_id, date, MIN(id) AS keep_id
        FROM attendance_logs
        GROUP BY user_id, date
        HAVING COUNT(*) > 1
      ) dups ON al.user_id = dups.user_id
            AND al.date     = dups.date
            AND al.id      != dups.keep_id
    `)

    // Step 3: Add the unique index that was missing from the original migration
    await queryRunner.createIndex(
      'attendance_logs',
      new TableIndex({
        name: 'UQ_attendance_log_user_date',
        columnNames: ['user_id', 'date'],
        isUnique: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('attendance_logs', 'UQ_attendance_log_user_date')
  }
}

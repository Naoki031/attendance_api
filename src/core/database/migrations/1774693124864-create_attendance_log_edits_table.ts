import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAttendanceLogEditsTable1774693124864 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_log_edits (
        id INT NOT NULL AUTO_INCREMENT,
        attendance_log_id INT NOT NULL,
        admin_id INT NOT NULL,
        old_clock_in TIME NULL,
        new_clock_in TIME NULL,
        old_clock_out TIME NULL,
        new_clock_out TIME NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_ale_attendance_log FOREIGN KEY (attendance_log_id) REFERENCES attendance_logs (id) ON DELETE CASCADE,
        CONSTRAINT fk_ale_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE attendance_log_edits`)
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateUserWorkSchedulesTable1774500000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_work_schedules (
        id          INT NOT NULL AUTO_INCREMENT,
        user_id     INT NOT NULL,
        start_time  TIME NOT NULL COMMENT 'Custom work start time',
        end_time    TIME NOT NULL COMMENT 'Custom work end time',
        effective_from DATE NOT NULL COMMENT 'Date from which schedule is active',
        effective_to   DATE NULL DEFAULT NULL COMMENT 'Date until which schedule is active, NULL = ongoing',
        note        TEXT NULL DEFAULT NULL COMMENT 'Reason for custom schedule',
        created_at  DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at  DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at  DATETIME(6) NULL DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_user_work_schedules_user_id (user_id),
        CONSTRAINT fk_user_work_schedules_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_work_schedules`)
  }
}

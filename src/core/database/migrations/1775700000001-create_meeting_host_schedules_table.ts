import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMeetingHostSchedulesTable1775700000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`meeting_host_schedules\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`meeting_id\` INT NOT NULL,
        \`user_id\` INT NOT NULL,
        \`schedule_type\` ENUM('one_time', 'date_list', 'date_range', 'recurring') NOT NULL,
        \`date\` DATE NULL,
        \`dates\` JSON NULL,
        \`date_from\` DATE NULL,
        \`date_to\` DATE NULL,
        \`day_of_week\` TINYINT NULL,
        \`interval_weeks\` TINYINT NULL,
        \`recur_start_date\` DATE NULL,
        \`recur_end_date\` DATE NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Add FK if not already present (idempotent)
    await queryRunner.query(`
      SET @fk_meeting := (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'meeting_host_schedules'
          AND CONSTRAINT_NAME = 'FK_mhs_meeting_id'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      )
    `)
    await queryRunner.query(`
      SET @sql_meeting := IF(@fk_meeting = 0,
        'ALTER TABLE \`meeting_host_schedules\` ADD CONSTRAINT \`FK_mhs_meeting_id\` FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\`(\`id\`) ON DELETE CASCADE',
        'SELECT 1'
      )
    `)
    await queryRunner.query(`PREPARE stmt_meeting FROM @sql_meeting`)
    await queryRunner.query(`EXECUTE stmt_meeting`)
    await queryRunner.query(`DEALLOCATE PREPARE stmt_meeting`)

    await queryRunner.query(`
      SET @fk_user := (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'meeting_host_schedules'
          AND CONSTRAINT_NAME = 'FK_mhs_user_id'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      )
    `)
    await queryRunner.query(`
      SET @sql_user := IF(@fk_user = 0,
        'ALTER TABLE \`meeting_host_schedules\` ADD CONSTRAINT \`FK_mhs_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE',
        'SELECT 1'
      )
    `)
    await queryRunner.query(`PREPARE stmt_user FROM @sql_user`)
    await queryRunner.query(`EXECUTE stmt_user`)
    await queryRunner.query(`DEALLOCATE PREPARE stmt_user`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`meeting_host_schedules\``)
  }
}

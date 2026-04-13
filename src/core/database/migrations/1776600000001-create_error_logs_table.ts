import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

export class CreateErrorLogsTable1776600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`error_logs\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`level\` VARCHAR(20) NOT NULL DEFAULT 'error',
        \`message\` VARCHAR(500) NOT NULL,
        \`stack_trace\` TEXT NULL,
        \`status_code\` INT NULL,
        \`path\` VARCHAR(500) NULL,
        \`method\` VARCHAR(10) NULL,
        \`request_body\` TEXT NULL,
        \`request_query\` VARCHAR(1000) NULL,
        \`request_headers\` TEXT NULL,
        \`user_id\` INT NULL,
        \`user_email\` VARCHAR(255) NULL,
        \`user_name\` VARCHAR(255) NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`user_agent\` VARCHAR(500) NULL,
        \`is_resolved\` TINYINT(1) NOT NULL DEFAULT 0,
        \`resolved_by\` INT NULL,
        \`resolved_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.createIndex(
      'error_logs',
      new TableIndex({
        name: 'IDX_error_logs_created_at',
        columnNames: ['created_at'],
      }),
    )

    await queryRunner.createIndex(
      'error_logs',
      new TableIndex({
        name: 'IDX_error_logs_level',
        columnNames: ['level'],
      }),
    )

    await queryRunner.createIndex(
      'error_logs',
      new TableIndex({
        name: 'IDX_error_logs_is_resolved',
        columnNames: ['is_resolved'],
      }),
    )

    await queryRunner.createIndex(
      'error_logs',
      new TableIndex({
        name: 'IDX_error_logs_resolved_created',
        columnNames: ['is_resolved', 'created_at'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('error_logs', 'IDX_error_logs_resolved_created')
    await queryRunner.dropIndex('error_logs', 'IDX_error_logs_is_resolved')
    await queryRunner.dropIndex('error_logs', 'IDX_error_logs_level')
    await queryRunner.dropIndex('error_logs', 'IDX_error_logs_created_at')
    await queryRunner.dropTable('error_logs')
  }
}

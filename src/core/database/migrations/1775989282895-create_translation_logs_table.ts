import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateTranslationLogsTable1775989282895 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS translation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT DEFAULT NULL,
        source_lang VARCHAR(10) NOT NULL,
        target_langs JSON NOT NULL,
        input_length INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL,
        error_message TEXT DEFAULT NULL,
        input_tokens INT DEFAULT NULL,
        output_tokens INT DEFAULT NULL,
        cache_creation_tokens INT DEFAULT NULL,
        cache_read_tokens INT DEFAULT NULL,
        model_used VARCHAR(50) DEFAULT NULL,
        duration_ms INT DEFAULT NULL,
        mode VARCHAR(10) DEFAULT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_translation_logs_status (status),
        INDEX idx_translation_logs_created_at (created_at),
        INDEX idx_translation_logs_message_id (message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS translation_logs`)
  }
}

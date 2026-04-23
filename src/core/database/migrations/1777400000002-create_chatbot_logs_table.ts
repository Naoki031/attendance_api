import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateChatbotLogsTable1777400000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chatbot_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_hash VARCHAR(64) NULL,
        role VARCHAR(10) NOT NULL,
        tone VARCHAR(20) NOT NULL,
        language VARCHAR(10) NULL,
        status VARCHAR(20) NOT NULL,
        input_tokens INT NULL,
        output_tokens INT NULL,
        cache_lookup_ms INT NULL,
        api_call_ms INT NULL,
        model_used VARCHAR(50) NULL,
        error_message TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX IDX_chatbot_logs_status (status),
        INDEX IDX_chatbot_logs_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chatbot_logs`)
  }
}

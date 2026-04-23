import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateChatbotCacheTables1777400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chatbot_cache_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        query_hash VARCHAR(64) NOT NULL,
        original_query TEXT NOT NULL,
        normalized_query TEXT NOT NULL,
        role VARCHAR(10) NOT NULL,
        tone VARCHAR(20) NOT NULL,
        language VARCHAR(10) NULL,
        reply TEXT NOT NULL,
        suggestions JSON NOT NULL,
        section_ids JSON NOT NULL,
        model_used VARCHAR(50) NOT NULL,
        hit_count INT DEFAULT 1,
        last_hit_at TIMESTAMP NULL DEFAULT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX UQ_cache_hash_role_tone (query_hash, role, tone),
        INDEX IDX_cache_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // FULLTEXT index must be added separately (not supported in CREATE TABLE IF NOT EXISTS)
    const [fulltextRows] = (await queryRunner.query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'chatbot_cache_entries'
        AND INDEX_NAME = 'FT_cache_normalized'
    `)) as [{ cnt: string }]

    if (parseInt(fulltextRows.cnt, 10) === 0) {
      await queryRunner.query(`
        ALTER TABLE chatbot_cache_entries
        ADD FULLTEXT INDEX FT_cache_normalized (normalized_query)
      `)
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chatbot_prompt_section_hashes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        section_id VARCHAR(100) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX UQ_section_id (section_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chatbot_cache_entries`)
    await queryRunner.query(`DROP TABLE IF EXISTS chatbot_prompt_section_hashes`)
  }
}

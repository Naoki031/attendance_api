import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMemoryAlbumCommentsTable1776572078850 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_album_comments (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        album_id VARCHAR(36) NOT NULL,
        user_id INT NOT NULL,
        text TEXT NOT NULL,
        detected_language VARCHAR(10) NULL DEFAULT NULL,
        translations JSON NULL DEFAULT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_memory_album_comments_album_id (album_id),
        INDEX idx_memory_album_comments_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS memory_album_comments`)
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMemoryViewsTables1776585631910 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_album_views (
        id INT NOT NULL AUTO_INCREMENT,
        album_id VARCHAR(36) NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_album_view_user (album_id, user_id),
        KEY idx_album_view_album (album_id),
        KEY idx_album_view_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_photo_views (
        id INT NOT NULL AUTO_INCREMENT,
        photo_id VARCHAR(36) NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_photo_view_user (photo_id, user_id),
        KEY idx_photo_view_photo (photo_id),
        KEY idx_photo_view_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS memory_photo_views`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_album_views`)
  }
}

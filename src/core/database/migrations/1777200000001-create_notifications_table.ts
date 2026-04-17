import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateNotificationsTable1777200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id      INT NOT NULL,
        type         VARCHAR(50) NOT NULL,
        title        VARCHAR(255) NOT NULL,
        body         TEXT NULL,
        icon         VARCHAR(80) NULL,
        icon_color   VARCHAR(30) NULL,
        route        VARCHAR(500) NULL,
        data         JSON NULL,
        is_read      TINYINT(1) NOT NULL DEFAULT 0,
        read_at      TIMESTAMP NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_notifications_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        INDEX IDX_notifications_user_id (user_id),
        INDEX IDX_notifications_user_is_read (user_id, is_read),
        INDEX IDX_notifications_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`)
  }
}

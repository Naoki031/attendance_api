import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLastSeenAtToUsers1775321442373 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL
        COMMENT 'Timestamp of the most recent authenticated request from this user'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN last_seen_at
    `)
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLikedByIdsToMemoryComments1776500731463 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN liked_by_ids JSON NULL DEFAULT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN liked_by_ids`)
  }
}

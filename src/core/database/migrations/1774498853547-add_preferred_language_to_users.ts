import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPreferredLanguageToUsers1774498853547 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN preferred_language VARCHAR(5) NULL DEFAULT 'en'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN preferred_language`)
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFcmTokenToUsers1774900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN fcm_token TEXT NULL COMMENT 'Firebase Cloud Messaging token for push notifications'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN fcm_token`)
  }
}

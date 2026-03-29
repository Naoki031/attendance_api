import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeviceUserIdToUsers1774407709359 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN device_user_id INT NULL DEFAULT NULL COMMENT 'ZKTeco device user ID for attendance sync'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN device_user_id
    `)
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPermanentRemoteToUsers1774664878158 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN permanent_remote BOOLEAN NOT NULL DEFAULT FALSE
      COMMENT 'User has permanent remote/work from home privilege, no daily WFH request needed'
    `)
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN permanent_remote_reason TEXT NULL
      COMMENT 'Reason for permanent remote privilege'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN permanent_remote_reason`)
    await queryRunner.query(`ALTER TABLE users DROP COLUMN permanent_remote`)
  }
}

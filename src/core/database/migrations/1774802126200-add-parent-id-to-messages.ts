import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddParentIdToMessages1774802126200 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE messages ADD COLUMN parent_id INT NULL AFTER previous_content`,
    )
    await queryRunner.query(
      `ALTER TABLE messages ADD CONSTRAINT fk_messages_parent FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE`,
    )
    await queryRunner.query(`CREATE INDEX idx_messages_parent_id ON messages(parent_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_messages_parent_id ON messages`)
    await queryRunner.query(`ALTER TABLE messages DROP FOREIGN KEY fk_messages_parent`)
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN parent_id`)
  }
}

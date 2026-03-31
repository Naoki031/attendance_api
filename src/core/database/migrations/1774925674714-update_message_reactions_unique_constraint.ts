import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateMessageReactionsUniqueConstraint1774925674714 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old unique constraint on (message_id, user_id, emoji)
    await queryRunner.query(
      `ALTER TABLE message_reactions DROP INDEX \`UQ_message_reactions_message_user_emoji\``,
    )

    // Add new unique constraint on (message_id, user_id) — one reaction per user per message
    await queryRunner.query(
      `ALTER TABLE message_reactions ADD CONSTRAINT \`UQ_message_reactions_message_user\` UNIQUE (\`message_id\`, \`user_id\`)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE message_reactions DROP INDEX \`UQ_message_reactions_message_user\``,
    )

    await queryRunner.query(
      `ALTER TABLE message_reactions ADD CONSTRAINT \`UQ_message_reactions_message_user_emoji\` UNIQUE (\`message_id\`, \`user_id\`, \`emoji\`)`,
    )
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateUserContractsTable1777000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_contracts (
        id INT AUTO_INCREMENT NOT NULL,
        user_id INT NOT NULL,
        contract_number INT NOT NULL COMMENT 'Sequential contract number for this user (1, 2, 3...)',
        contract_type VARCHAR(255) NOT NULL COMMENT 'Contract type: probation | fixed_term | indefinite',
        signed_date DATE NOT NULL,
        expired_date DATE NULL COMMENT 'NULL for indefinite contracts',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_user_contracts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_contracts`)
  }
}

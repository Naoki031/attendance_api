import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddKycStatusToUsers1775200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users
        ADD COLUMN kyc_status ENUM('pending', 'approved', 'rejected') NULL DEFAULT NULL
          COMMENT 'KYC approval status: pending=awaiting admin review, approved=active for check-in, rejected=user must re-submit'
          AFTER face_avatar_url,
        ADD COLUMN kyc_rejection_reason VARCHAR(500) NULL DEFAULT NULL
          COMMENT 'Admin reason when KYC was rejected'
          AFTER kyc_status`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users
        DROP COLUMN kyc_rejection_reason,
        DROP COLUMN kyc_status`,
    )
  }
}

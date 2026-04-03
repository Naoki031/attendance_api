import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFaceRecognitionFields1775100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add face descriptor (128-element float array stored as JSON) and avatar URL to users
    await queryRunner.query(
      `ALTER TABLE users
        ADD COLUMN face_descriptor JSON NULL COMMENT 'Face descriptor (128-element float array) from face-api.js',
        ADD COLUMN face_avatar_url VARCHAR(500) NULL COMMENT 'URL of registered face avatar image on S3/MinIO'`,
    )

    // Add face check-in metadata to attendance_logs
    await queryRunner.query(
      `ALTER TABLE attendance_logs
        ADD COLUMN checkin_image_url VARCHAR(500) NULL COMMENT 'URL of photo taken at check-in/out moment',
        ADD COLUMN confidence FLOAT NULL COMMENT 'Face match confidence score (0.0 - 1.0)',
        ADD COLUMN ip_address VARCHAR(45) NULL COMMENT 'Client IP address at time of attendance',
        ADD COLUMN device_info TEXT NULL COMMENT 'Client User-Agent string at time of attendance'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE attendance_logs
        DROP COLUMN device_info,
        DROP COLUMN ip_address,
        DROP COLUMN confidence,
        DROP COLUMN checkin_image_url`,
    )

    await queryRunner.query(
      `ALTER TABLE users
        DROP COLUMN face_avatar_url,
        DROP COLUMN face_descriptor`,
    )
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import * as fs from 'fs'
import * as path from 'path'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3Client: S3Client | null
  private readonly bucket: string
  private readonly publicUrl: string
  private readonly useLocal: boolean

  constructor(
    private readonly configService: ConfigService,
    private readonly errorLogsService: ErrorLogsService,
  ) {
    const accessKey = this.configService.get<string>('AWS_ACCESS_KEY')
    const endpoint = this.configService.get<string>('S3_ENDPOINT')

    // Fall back to local disk storage when S3 credentials are not configured
    this.useLocal = !accessKey

    if (this.useLocal) {
      this.logger.warn(
        'AWS_ACCESS_KEY not set — using local disk storage (uploads/). Configure S3 env vars for production.',
      )
      this.s3Client = null
      this.bucket = ''
      this.publicUrl = ''

      return
    }

    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') ?? 'ap-southeast-1',
      credentials: {
        accessKeyId: accessKey ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_KEY') ?? '',
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    })

    this.bucket = this.configService.get<string>('S3_BUCKET') ?? 'attendance'

    const s3PublicUrl = this.configService.get<string>('S3_PUBLIC_URL')
    const awsRegion = this.configService.get<string>('AWS_REGION') ?? 'ap-southeast-1'

    if (s3PublicUrl) {
      this.publicUrl = s3PublicUrl
    } else if (endpoint) {
      this.publicUrl = `${endpoint}/${this.bucket}`
    } else {
      this.publicUrl = `https://${this.bucket}.s3.${awsRegion}.amazonaws.com`
    }
  }

  /**
   * Uploads an image buffer to S3/MinIO, or saves to local disk if S3 is not configured.
   * @param buffer - Raw image bytes
   * @param folder - Destination folder: 'checkin' or 'avatars'
   * @param userId - Owner user ID, used to organise files under a per-user sub-directory
   * @returns Public URL of the uploaded image
   */
  async uploadImage(
    buffer: Buffer,
    folder: 'checkin' | 'avatars',
    userId: number,
  ): Promise<string> {
    const date = moment().format('YYYY-MM-DD')
    const filename = `${uuidv4()}.jpg`

    if (this.useLocal) {
      return this.saveLocal(buffer, folder, date, userId, filename)
    }

    const key = `${folder}/${date}/${userId}/${filename}`

    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      }),
    )

    return `${this.publicUrl}/${key}`
  }

  /**
   * Deletes an image from S3/MinIO by its public URL.
   * No-op for local files (dev mode).
   * @param url - Full public URL of the image to delete
   */
  async deleteImage(url: string): Promise<void> {
    if (this.useLocal) return

    try {
      const key = url.replace(`${this.publicUrl}/`, '')

      await this.s3Client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    } catch (error) {
      this.logger.error(`Failed to delete image at ${url}:`, error)
      this.errorLogsService.logError({
        message: `Failed to delete image at ${url}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'storage',
      })
    }
  }

  /**
   * Returns the absolute path to the private-uploads directory root.
   * Used by StorageController to resolve and stream files securely.
   */
  getPrivateUploadsRoot(): string {
    return path.join(process.cwd(), 'private-uploads')
  }

  /**
   * Saves image to private-uploads/ (not served as static files).
   * Access requires authentication via StorageController.
   */
  private saveLocal(
    buffer: Buffer,
    folder: string,
    date: string,
    userId: number,
    filename: string,
  ): string {
    const uploadDirectory = path.join(
      process.cwd(),
      'private-uploads',
      folder,
      date,
      String(userId),
    )
    fs.mkdirSync(uploadDirectory, { recursive: true })
    fs.writeFileSync(path.join(uploadDirectory, filename), buffer)

    const apiPrefix = process.env.API_PREFIX ?? 'api/v1'

    return `/${apiPrefix}/storage/${folder}/${date}/${userId}/${filename}`
  }
}

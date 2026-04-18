import * as path from 'path'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import type { Request } from 'express'
import { diskStorage } from 'multer'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
])

export const memoriesMulterConfig = {
  storage: diskStorage({
    destination: (
      request: Request,
      _file: Express.Multer.File,
      callback: (error: Error | null, destination: string) => void,
    ) => {
      const albumId = (request.params['id'] as string) ?? 'unknown'
      const uploadDirectory = path.join(process.cwd(), 'uploads', 'memories', albumId)
      if (!fs.existsSync(uploadDirectory)) {
        fs.mkdirSync(uploadDirectory, { recursive: true })
      }
      callback(null, uploadDirectory)
    },
    filename: (
      _request: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filename = `${uuidv4()}_${sanitized}`
      callback(null, filename)
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (
    _request: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    callback(null, ALLOWED_MIME_TYPES.has(file.mimetype))
  },
}

import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common'
import { Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { StorageService } from './storage.service'

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Serves a privately stored image file.
   * Protected by the global JWT guard — requires a valid Bearer token.
   * Only allows access to files under private-uploads/avatars/ and private-uploads/checkin/.
   *
   * @param folder  - 'avatars' or 'checkin'
   * @param date    - 'YYYY-MM-DD'
   * @param filename - UUID filename (e.g. 'abc123.jpg')
   */
  @Get(':folder/:date/:userId/:filename')
  serveFile(
    @Param('folder') folder: string,
    @Param('date') date: string,
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Res() response: Response,
  ): void {
    const allowedFolders = ['avatars', 'checkin']

    if (!allowedFolders.includes(folder)) {
      throw new NotFoundException('File not found')
    }

    // Sanitize: reject path traversal attempts
    const safeFilename = path.basename(filename)
    const safeDate = date.replace(/[^0-9-]/g, '')
    const safeUserId = userId.replace(/[^0-9]/g, '')

    const filePath = path.join(
      this.storageService.getPrivateUploadsRoot(),
      folder,
      safeDate,
      safeUserId,
      safeFilename,
    )

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found')
    }

    response.setHeader('Content-Type', 'image/jpeg')

    // Prevent browser caching — ensures stale tokens cannot reuse cached responses
    response.setHeader('Cache-Control', 'no-store')

    // Prevent MIME type sniffing
    response.setHeader('X-Content-Type-Options', 'nosniff')

    // Prevent embedding in iframes
    response.setHeader('X-Frame-Options', 'DENY')

    // Prevent the browser from rendering the image in a standalone tab via navigation
    response.setHeader('Content-Security-Policy', "default-src 'none'")
    response.sendFile(filePath)
  }
}

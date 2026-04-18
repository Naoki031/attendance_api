export const storageConfig = {
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  memoriesDir: 'uploads/memories',
  maxFileSize: 50 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'application/pdf',
  ],
}

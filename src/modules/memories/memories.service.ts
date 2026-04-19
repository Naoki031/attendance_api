import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as archiver from 'archiver'
import sharp from 'sharp'
import { MemoryAlbum, Privacy } from './entities/memory_album.entity'
import { MemoryPhoto } from './entities/memory_photo.entity'
import { MemoryReaction, ReactionType } from './entities/memory_reaction.entity'
import { MemoryComment } from './entities/memory_comment.entity'
import type { CreateAlbumDto } from './dto/create-album.dto'
import type { UpdateAlbumDto } from './dto/update-album.dto'
import type { CreateCommentDto } from './dto/create-comment.dto'
import type { SharePhotoDto } from './dto/share-photo.dto'
import type { ShareAlbumDto } from './dto/share-album.dto'
import type { QueryAlbumsDto } from './dto/query-albums.dto'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'
import { TranslateService } from '@/modules/translate/translate.service'
import { ChatService } from '@/modules/chat/chat.service'
import { ChatRoomService } from '@/modules/chat/chat-room.service'
import { ChatGateway } from '@/modules/chat/chat.gateway'
import { UsersService } from '@/modules/users/users.service'

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface ReactionSummary {
  counts: Record<string, number>
  reactorsByType: Record<string, { id: string; name: string }[]>
}

export type CommentReactionEntry = { id: number; name: string }

export interface CommentWithUser {
  id: string
  photoId: string
  userId: string
  text: string
  reactions: Record<string, CommentReactionEntry[]>
  detectedLanguage: string | null
  createdAt: Date
  updatedAt: Date
  user: { id: number; name: string; avatar: string | null }
}

interface DownloadToken {
  albumId: string
  userId: number
  expiresAt: number
}

@Injectable()
export class MemoriesService {
  private readonly logger = new Logger(MemoriesService.name)
  private readonly downloadTokens = new Map<string, DownloadToken>()

  constructor(
    @InjectRepository(MemoryAlbum)
    private readonly albumRepository: Repository<MemoryAlbum>,
    @InjectRepository(MemoryPhoto)
    private readonly photoRepository: Repository<MemoryPhoto>,
    @InjectRepository(MemoryReaction)
    private readonly reactionRepository: Repository<MemoryReaction>,
    @InjectRepository(MemoryComment)
    private readonly commentRepository: Repository<MemoryComment>,
    private readonly errorLogsService: ErrorLogsService,
    private readonly translateService: TranslateService,
    private readonly chatService: ChatService,
    private readonly chatRoomService: ChatRoomService,
    private readonly chatGateway: ChatGateway,
    private readonly usersService: UsersService,
  ) {}

  // ─── ALBUM ────────────────────────────────────────────────────────────────

  /**
   * Returns paginated albums.
   * Public albums are visible to all authenticated users.
   * Private albums are visible only to creator or members.
   */
  async findAll(userId: number, query: QueryAlbumsDto): Promise<PaginatedResult<object>> {
    try {
      const page = query.page ?? 1
      const limit = query.limit ?? 20
      const skip = (page - 1) * limit

      const queryBuilder = this.albumRepository
        .createQueryBuilder('album')
        .where(
          `(album.privacy = :public
            OR album.created_by_id = :userId
            OR EXISTS (
              SELECT 1 FROM memory_album_members m
              WHERE m.album_id = album.id AND m.user_id = :userId
            ))`,
          { public: Privacy.PUBLIC, userId },
        )
        .orderBy('album.created_at', 'DESC')
        .skip(skip)
        .take(limit)

      if (query.privacy) {
        queryBuilder.andWhere('album.privacy = :privacy', { privacy: query.privacy })
      }

      if (query.eventType) {
        queryBuilder.andWhere('album.event_type = :eventType', { eventType: query.eventType })
      }

      const [albums, total] = await queryBuilder.getManyAndCount()

      const albumIds = albums.map((album) => album.id)
      const coverPhotoMap = await this.buildCoverPhotoMap(albumIds)

      // Batch fetch all members from junction table — one query for all albums
      const memberRows =
        albumIds.length > 0
          ? await this.albumRepository.manager.query<Array<{ album_id: string; user_id: number }>>(
              `SELECT album_id, user_id FROM memory_album_members
               WHERE album_id IN (${albumIds.map(() => '?').join(',')})`,
              albumIds,
            )
          : []

      const memberIdsMap = new Map<string, string[]>()
      for (const row of memberRows) {
        if (!memberIdsMap.has(row.album_id)) memberIdsMap.set(row.album_id, [])
        memberIdsMap.get(row.album_id)!.push(String(row.user_id))
      }

      const allMemberIds = [...new Set(memberRows.map((row) => String(row.user_id)))]
      const allMembers = await this.fetchMembersInfo(allMemberIds)
      const memberMap = new Map(allMembers.map((member) => [member.id, member]))

      const serialized = albums.map((album) => {
        const ids = memberIdsMap.get(album.id) ?? []
        const members = ids.map((id) => memberMap.get(id) ?? { id, name: id, avatar: null })
        return this.serializeAlbum(album, coverPhotoMap.get(album.id), members, ids)
      })

      return {
        items: serialized,
        total,
        page,
        limit,
        hasMore: page * limit < total,
      }
    } catch (error) {
      this.logger.error('Failed to fetch albums', error)
      this.errorLogsService.logError({
        message: 'Failed to fetch albums',
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Returns a single album's metadata (no photos — fetch separately with findPhotos).
   * Throws ForbiddenException if album is private and user is not creator/member.
   */
  async findOne(id: string, userId: number): Promise<object> {
    try {
      const album = await this.albumRepository.findOne({ where: { id } })
      if (!album) throw new NotFoundException('Album not found')

      await this.assertAlbumAccess(album, userId)

      return this.serializeAlbumAsync(album)
    } catch (error) {
      this.logger.error(`Failed to find album ${id}`, error)
      this.errorLogsService.logError({
        message: `Failed to find album ${id}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Returns paginated photos for an album.
   */
  async findPhotos(
    albumId: string,
    userId: number,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<object>> {
    try {
      const album = await this.albumRepository.findOne({ where: { id: albumId } })
      if (!album) throw new NotFoundException('Album not found')

      await this.assertAlbumAccess(album, userId)

      const skip = (page - 1) * limit
      const total: number = await this.photoRepository.count({ where: { albumId } })

      const rows = await this.photoRepository.manager.query<
        Array<{
          id: string
          album_id: string
          url: string
          thumbnail_url: string | null
          caption: string | null
          uploaded_by_id: number
          width: number
          height: number
          size: number
          mime_type: string
          created_at: Date
          first_name: string | null
          last_name: string | null
          avatar: string | null
        }>
      >(
        `SELECT p.id, p.album_id, p.url, p.thumbnail_url, p.caption,
                p.uploaded_by_id, p.width, p.height, p.size, p.mime_type, p.created_at,
                u.first_name, u.last_name, u.avatar
         FROM memory_photos p
         LEFT JOIN users u ON u.id = p.uploaded_by_id
         WHERE p.album_id = ?
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [albumId, limit, skip],
      )

      const items = rows.map((row) => ({
        id: row.id,
        albumId: row.album_id,
        url: row.url,
        thumbnailUrl: row.thumbnail_url ?? row.url,
        caption: row.caption ?? null,
        uploadedById: String(row.uploaded_by_id),
        uploadedByName: row.first_name ? `${row.first_name} ${row.last_name ?? ''}`.trim() : null,
        uploadedByAvatar: row.avatar ?? null,
        width: row.width ?? 0,
        height: row.height ?? 0,
        size: row.size,
        mimeType: row.mime_type,
        createdAt: row.created_at,
      }))

      return {
        items,
        total,
        page,
        limit,
        hasMore: skip + rows.length < total,
      }
    } catch (error) {
      this.logger.error(`Failed to fetch photos for album ${albumId}`, error)
      this.errorLogsService.logError({
        message: `Failed to fetch photos for album ${albumId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Creates an album. Automatically adds the creator to memberIds.
   */
  async create(userId: number, dto: CreateAlbumDto): Promise<object> {
    try {
      const memberIds = [...new Set([...(dto.memberIds ?? []), String(userId)])]

      const album = this.albumRepository.create({
        title: dto.title,
        description: dto.description,
        eventType: dto.eventType,
        date: dto.date,
        privacy: dto.privacy ?? Privacy.PUBLIC,
        createdById: userId,
        photoCount: 0,
      })

      const saved = await this.albumRepository.save(album)

      // Persist members in junction table
      await this.setAlbumMembers(saved.id, memberIds)

      return this.serializeAlbumAsync(saved)
    } catch (error) {
      this.logger.error('Failed to create album', error)
      this.errorLogsService.logError({
        message: 'Failed to create album',
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Updates the member list of an album. Any existing member or the creator can invite others.
   */
  async updateMembers(id: string, userId: number, memberIds: string[]): Promise<object> {
    try {
      const album = await this.albumRepository.findOne({ where: { id } })
      if (!album) throw new NotFoundException('Album not found')
      await this.assertAlbumAccess(album, userId)

      const merged = [...new Set([...memberIds, String(album.createdById)])]
      await this.setAlbumMembers(id, merged)

      const updated = (await this.albumRepository.findOne({ where: { id } }))!
      return this.serializeAlbumAsync(updated)
    } catch (error) {
      this.logger.error(`Failed to update members for album ${id}`, error)
      this.errorLogsService.logError({
        message: `Failed to update members for album ${id}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Updates an album. Only the creator can update.
   */
  async update(id: string, userId: number, dto: UpdateAlbumDto): Promise<object> {
    try {
      const album = await this.albumRepository.findOne({ where: { id } })
      if (!album) throw new NotFoundException('Album not found')
      if (album.createdById !== userId)
        throw new ForbiddenException('Only the creator can update this album')

      const updates: Partial<MemoryAlbum> = {}
      if (dto.title !== undefined) updates.title = dto.title
      if (dto.description !== undefined) updates.description = dto.description
      if (dto.privacy !== undefined) updates.privacy = dto.privacy
      if (dto.eventType !== undefined) updates.eventType = dto.eventType
      if (dto.date !== undefined) updates.date = dto.date

      if (Object.keys(updates).length > 0) {
        await this.albumRepository.update({ id }, updates)
      }

      if (dto.memberIds !== undefined) {
        const merged = [...new Set([...dto.memberIds, String(album.createdById)])]
        await this.setAlbumMembers(id, merged)
      }

      const updated = (await this.albumRepository.findOne({ where: { id } }))!

      return this.serializeAlbumAsync(updated)
    } catch (error) {
      this.logger.error(`Failed to update album ${id}`, error)
      this.errorLogsService.logError({
        message: `Failed to update album ${id}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Deletes an album and all its photos from disk. Only the creator can remove.
   */
  async remove(id: string, userId: number): Promise<void> {
    try {
      const album = await this.albumRepository.findOne({ where: { id } })
      if (!album) throw new NotFoundException('Album not found')
      if (album.createdById !== userId)
        throw new ForbiddenException('Only the creator can delete this album')

      const photos = await this.photoRepository.find({ where: { albumId: id } })

      await this.albumRepository.delete({ id })

      for (const photo of photos) {
        this.deleteFileFromDisk(photo.url)
        if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.url) {
          this.deleteFileFromDisk(photo.thumbnailUrl)
        }
      }
    } catch (error) {
      this.logger.error(`Failed to remove album ${id}`, error)
      this.errorLogsService.logError({
        message: `Failed to remove album ${id}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── PHOTO ────────────────────────────────────────────────────────────────

  /**
   * Uploads one or more photos to an album.
   * Validates that uploader is a member or creator of the album.
   */
  async uploadPhotos(
    albumId: string,
    userId: number,
    files: Express.Multer.File[],
  ): Promise<object[]> {
    try {
      const album = await this.albumRepository.findOne({ where: { id: albumId } })
      if (!album) throw new NotFoundException('Album not found')

      await this.assertAlbumAccess(album, userId)

      const albumDirectory = path.join(process.cwd(), 'uploads', 'memories', albumId)
      fs.mkdirSync(albumDirectory, { recursive: true })

      const thumbDirectory = path.join(albumDirectory, 'thumbs')
      fs.mkdirSync(thumbDirectory, { recursive: true })

      const processFile = async (file: Express.Multer.File): Promise<object> => {
        const filename = path.basename(file.path)
        const destinationPath = path.join(albumDirectory, filename)
        fs.renameSync(file.path, destinationPath)

        const photoUrl = `/uploads/memories/${albumId}/${filename}`
        let thumbnailUrl = photoUrl
        let width = 0
        let height = 0

        if (file.mimetype.startsWith('image/')) {
          try {
            const image = sharp(destinationPath)
            const metadata = await image.metadata()
            width = metadata.width ?? 0
            height = metadata.height ?? 0

            const thumbFilename = `thumb_${filename.replace(/\.[^.]+$/, '')}.webp`
            const thumbPath = path.join(thumbDirectory, thumbFilename)

            await image
              .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toFile(thumbPath)

            thumbnailUrl = `/uploads/memories/${albumId}/thumbs/${thumbFilename}`
          } catch {
            this.logger.warn(`Failed to process image ${filename}, using original`)
          }
        }

        const photo = this.photoRepository.create({
          albumId,
          url: photoUrl,
          thumbnailUrl,
          uploadedById: userId,
          width,
          height,
          size: file.size,
          mimeType: file.mimetype,
        })

        const saved = await this.photoRepository.save(photo)
        return this.serializePhoto(saved)
      }

      const savedPhotos = await Promise.all(files.map((file) => processFile(file)))

      // Use SQL increment to avoid race condition when concurrent uploads happen
      await this.albumRepository
        .createQueryBuilder()
        .update(MemoryAlbum)
        .set({ photoCount: () => `photo_count + ${files.length}` })
        .where('id = :id', { id: albumId })
        .execute()

      return savedPhotos
    } catch (error) {
      this.logger.error(`Failed to upload photos to album ${albumId}`, error)
      this.errorLogsService.logError({
        message: `Failed to upload photos to album ${albumId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Issues a one-time short-lived token for album download.
   * Token expires in 5 minutes and is consumed on first use.
   */
  async createDownloadToken(albumId: string, userId: number): Promise<{ token: string }> {
    try {
      const album = await this.albumRepository.findOne({ where: { id: albumId } })
      if (!album) throw new NotFoundException('Album not found')

      if (album.privacy === Privacy.PRIVATE)
        throw new ForbiddenException('Private albums cannot be downloaded')

      const [memberRow] = await this.albumRepository.manager.query<[{ cnt: number }]>(
        `SELECT COUNT(*) AS cnt FROM memory_album_members WHERE album_id = ? AND user_id = ?`,
        [albumId, userId],
      )
      const isMember = album.createdById === userId || Number(memberRow?.cnt) > 0
      if (!isMember) throw new ForbiddenException('You are not a member of this album')

      // Purge expired tokens on each issuance
      const now = Date.now()
      for (const [key, value] of this.downloadTokens) {
        if (value.expiresAt < now) this.downloadTokens.delete(key)
      }

      const token = crypto.randomBytes(32).toString('hex')
      this.downloadTokens.set(token, { albumId, userId, expiresAt: now + 5 * 60 * 1000 })
      return { token }
    } catch (error) {
      this.logger.error(`Failed to create download token for album ${albumId}`, error)
      this.errorLogsService.logError({
        message: `Failed to create download token for album ${albumId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Streams a zip archive of all photos in an album.
   * Validates via one-time download token (consumed on use).
   */
  async downloadAlbum(token: string): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
    try {
      const entry = this.downloadTokens.get(token)
      if (!entry || entry.expiresAt < Date.now())
        throw new ForbiddenException('Invalid or expired download token')

      const { albumId } = entry

      const album = await this.albumRepository.findOne({ where: { id: albumId } })
      if (!album) throw new NotFoundException('Album not found')

      // Check privacy BEFORE consuming the token so a rejected request doesn't waste it
      if (album.privacy === Privacy.PRIVATE)
        throw new ForbiddenException('Private albums cannot be downloaded')

      // Consume the token — one use only
      this.downloadTokens.delete(token)

      const photos = await this.photoRepository.find({ where: { albumId } })

      const archive = archiver.create('zip', { zlib: { level: 6 } })

      photos.forEach((photo, index) => {
        const filePath = path.join(process.cwd(), photo.url.replace(/^\/+/, ''))
        if (fs.existsSync(filePath)) {
          const extension = path.extname(filePath) || '.jpg'
          const paddedIndex = String(index + 1).padStart(3, '0')
          archive.file(filePath, { name: `photo_${paddedIndex}${extension}` })
        }
      })

      archive.finalize()

      // Include Latin Extended Additional (U+1E00–U+1EFF) for Vietnamese diacritics
      const safeTitle =
        album.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s_-]/g, '').trim() || 'album'
      return { stream: archive, filename: `${safeTitle}.zip` }
    } catch (error) {
      this.logger.error(`Failed to create zip (token: ${token})`, error)
      this.errorLogsService.logError({
        message: `Failed to create zip (token: ${token})`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Deletes a photo. Only the uploader or album creator can remove.
   */
  async removePhoto(photoId: string, userId: number): Promise<void> {
    try {
      const photo = await this.photoRepository.findOne({ where: { id: photoId } })
      if (!photo) throw new NotFoundException('Photo not found')

      const album = await this.albumRepository.findOne({ where: { id: photo.albumId } })

      if (photo.uploadedById !== userId && album?.createdById !== userId) {
        throw new ForbiddenException('Only the uploader or album creator can delete this photo')
      }

      await this.photoRepository.delete({ id: photoId })

      this.deleteFileFromDisk(photo.url)
      if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.url) {
        this.deleteFileFromDisk(photo.thumbnailUrl)
      }

      if (album) {
        await this.albumRepository
          .createQueryBuilder()
          .update(MemoryAlbum)
          .set({ photoCount: () => 'CASE WHEN photo_count > 0 THEN photo_count - 1 ELSE 0 END' })
          .where('id = :id', { id: photo.albumId })
          .execute()
      }
    } catch (error) {
      this.logger.error(`Failed to remove photo ${photoId}`, error)
      this.errorLogsService.logError({
        message: `Failed to remove photo ${photoId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── REACTION ─────────────────────────────────────────────────────────────

  /**
   * Returns all reactions for a photo grouped by type with counts and user IDs.
   * Enforces album access control — private albums require membership.
   */
  async getReactions(photoId: string, userId: number): Promise<ReactionSummary> {
    try {
      // Single JOIN replaces 2 serial findOne calls for access control
      const [accessRow] = await this.photoRepository.manager.query<
        Array<{
          album_id: string
          privacy: string
          created_by_id: number
          is_member: number
        }>
      >(
        `SELECT p.album_id, a.privacy, a.created_by_id,
                EXISTS(SELECT 1 FROM memory_album_members m WHERE m.album_id = a.id AND m.user_id = ?) AS is_member
         FROM memory_photos p
         JOIN memory_albums a ON a.id = p.album_id
         WHERE p.id = ?`,
        [userId, photoId],
      )
      if (!accessRow) throw new NotFoundException('Photo not found')

      if (
        accessRow.privacy === 'private' &&
        accessRow.created_by_id !== userId &&
        !Number(accessRow.is_member)
      ) {
        throw new ForbiddenException('You do not have access to this album')
      }

      // JOIN with users — one query instead of find-all + separate user lookup
      const rows = await this.reactionRepository.manager.query<
        Array<{ type: string; user_id: number; first_name: string; last_name: string }>
      >(
        `SELECT r.type, r.user_id, u.first_name, u.last_name
         FROM memory_reactions r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.photo_id = ?`,
        [photoId],
      )

      const counts: Record<string, number> = {}
      const reactorsByType: Record<string, { id: string; name: string }[]> = {}

      for (const row of rows) {
        counts[row.type] = (counts[row.type] ?? 0) + 1
        reactorsByType[row.type] = [
          ...(reactorsByType[row.type] ?? []),
          { id: String(row.user_id), name: `${row.first_name} ${row.last_name}`.trim() },
        ]
      }

      return { counts, reactorsByType }
    } catch (error) {
      this.logger.error(`Failed to get reactions for photo ${photoId}`, error)
      this.errorLogsService.logError({
        message: `Failed to get reactions for photo ${photoId} by user ${userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Toggles a reaction.
   * Same type → remove. Different type → switch. No reaction → add.
   * Returns the user's current reaction type and all type counts.
   */
  async toggleReaction(
    photoId: string,
    userId: number,
    type: ReactionType,
  ): Promise<{ userReactionType: string | null; counts: Record<string, number> }> {
    try {
      const photo = await this.photoRepository.findOne({ where: { id: photoId } })
      if (!photo) throw new NotFoundException('Photo not found')

      const existing = await this.reactionRepository.findOne({ where: { photoId, userId } })

      if (existing) {
        if (existing.type === type) {
          await this.reactionRepository.delete({ id: existing.id })
        } else {
          await this.reactionRepository.update({ id: existing.id }, { type })
        }
      } else {
        await this.reactionRepository.save(
          this.reactionRepository.create({ photoId, userId, type }),
        )
      }

      // GROUP BY in SQL — avoids loading all rows into memory just to count
      const countRows = await this.reactionRepository.manager.query<
        Array<{ type: string; cnt: string; is_mine: number }>
      >(
        `SELECT type, COUNT(*) AS cnt,
                MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS is_mine
         FROM memory_reactions
         WHERE photo_id = ?
         GROUP BY type`,
        [userId, photoId],
      )

      const counts: Record<string, number> = {}
      let myType: string | null = null

      for (const row of countRows) {
        counts[row.type] = Number(row.cnt)
        if (Number(row.is_mine) === 1) myType = row.type
      }

      return { userReactionType: myType, counts }
    } catch (error) {
      this.logger.error(`Failed to toggle reaction for photo ${photoId}`, error)
      this.errorLogsService.logError({
        message: `Failed to toggle reaction for photo ${photoId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── COMMENT ──────────────────────────────────────────────────────────────

  /**
   * Returns all comments for a photo with uploader info, sorted ASC by createdAt.
   */
  private normalizeCommentReactions(
    raw: unknown,
    nameMap: Map<number, string>,
  ): Record<string, CommentReactionEntry[]> {
    let parsed = raw
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        return {}
      }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, CommentReactionEntry[]> = {}
    for (const [type, entries] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue
      result[type] = entries
        .filter((entry) => entry !== null && entry !== undefined)
        .map((entry) =>
          typeof entry === 'object'
            ? (entry as CommentReactionEntry)
            : { id: Number(entry), name: nameMap.get(Number(entry)) ?? '' },
        )
        .filter((entry) => entry.id > 0)
    }
    return result
  }

  /**
   * Returns all comments for a photo with uploader info, sorted ASC by createdAt.
   * Enforces album access control — private albums require membership.
   */
  async getComments(photoId: string, userId: number): Promise<CommentWithUser[]> {
    try {
      const photo = await this.photoRepository.findOne({ where: { id: photoId } })
      if (!photo) throw new NotFoundException('Photo not found')

      const album = await this.albumRepository.findOne({ where: { id: photo.albumId } })
      if (!album) throw new NotFoundException('Album not found')
      await this.assertAlbumAccess(album, userId)

      const rows = await this.commentRepository.manager.query<
        Array<{
          id: string
          photo_id: string
          user_id: number
          text: string
          reactions: unknown
          detected_language: string | null
          created_at: Date
          updated_at: Date
          first_name: string
          last_name: string
          avatar: string | null
        }>
      >(
        `SELECT c.id, c.photo_id, c.user_id, c.text, c.reactions, c.detected_language, c.created_at, c.updated_at,
                u.first_name, u.last_name, u.avatar
         FROM memory_comments c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.photo_id = ?
         ORDER BY c.created_at ASC
         LIMIT 100`,
        [photoId],
      )

      // Collect all legacy numeric reactor IDs that need name resolution
      const legacyIds = new Set<number>()
      for (const row of rows) {
        let parsed = row.reactions
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed)
          } catch {
            continue
          }
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
        for (const entries of Object.values(parsed as Record<string, unknown>)) {
          if (!Array.isArray(entries)) continue
          for (const entry of entries) {
            if (typeof entry === 'number') legacyIds.add(entry)
          }
        }
      }

      const nameMap = new Map<number, string>()
      if (legacyIds.size > 0) {
        const ids = Array.from(legacyIds)
        const userRows = await this.commentRepository.manager.query<
          Array<{ id: number; first_name: string; last_name: string }>
        >(
          `SELECT id, first_name, last_name FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids,
        )
        for (const userRow of userRows) {
          nameMap.set(userRow.id, `${userRow.first_name} ${userRow.last_name}`.trim())
        }
      }

      return rows.map((row) => ({
        id: row.id,
        photoId: row.photo_id,
        userId: String(row.user_id),
        text: row.text,
        reactions: this.normalizeCommentReactions(row.reactions, nameMap),
        detectedLanguage: row.detected_language ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        user: {
          id: row.user_id,
          name: `${row.first_name} ${row.last_name}`.trim(),
          avatar: row.avatar,
        },
      }))
    } catch (error) {
      this.logger.error(`Failed to get comments for photo ${photoId}`, error)
      this.errorLogsService.logError({
        message: `Failed to get comments for photo ${photoId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Adds a comment to a photo.
   */
  async addComment(photoId: string, userId: number, dto: CreateCommentDto): Promise<object> {
    try {
      const photo = await this.photoRepository.findOne({ where: { id: photoId } })
      if (!photo) throw new NotFoundException('Photo not found')

      const comment = this.commentRepository.create({ photoId, userId, text: dto.text })
      const saved = await this.commentRepository.save(comment)

      // Detect language asynchronously — does not block the response
      if (this.translateService.isTranslatableContent(dto.text)) {
        this.translateService
          .detectLanguage(dto.text)
          .then((lang) => {
            if (lang && lang !== 'unknown') {
              return this.commentRepository.update(saved.id, { detectedLanguage: lang })
            }
          })
          .catch(() => {
            // silently ignore — translate button just won't show
          })
      }

      return {
        id: saved.id,
        photoId: saved.photoId,
        userId: String(saved.userId),
        text: saved.text,
        detectedLanguage: null,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        user: null,
      }
    } catch (error) {
      this.logger.error(`Failed to add comment to photo ${photoId}`, error)
      this.errorLogsService.logError({
        message: `Failed to add comment to photo ${photoId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Updates the text of a comment. Only the comment owner can edit.
   * Resets cached translations and detected language since the text has changed.
   */
  async updateComment(
    commentId: string,
    userId: number,
    dto: { text: string },
  ): Promise<{ id: string; text: string; updatedAt: Date }> {
    try {
      const comment = await this.commentRepository.findOne({ where: { id: commentId } })
      if (!comment) throw new NotFoundException('Comment not found')

      if (comment.userId !== userId) {
        throw new ForbiddenException('Only the comment owner can edit this comment')
      }

      await this.commentRepository.update(
        { id: commentId },
        { text: dto.text, translations: null, detectedLanguage: null },
      )

      // Re-detect language async so translate button updates on next fetch
      if (this.translateService.isTranslatableContent(dto.text)) {
        this.translateService
          .detectLanguage(dto.text)
          .then((lang) => {
            if (lang && lang !== 'unknown') {
              return this.commentRepository.update({ id: commentId }, { detectedLanguage: lang })
            }
          })
          .catch(() => {})
      }

      const updated = await this.commentRepository.findOne({ where: { id: commentId } })
      return { id: commentId, text: dto.text, updatedAt: updated!.updatedAt }
    } catch (error) {
      this.logger.error(`Failed to update comment ${commentId}`, error)
      this.errorLogsService.logError({
        message: `Failed to update comment ${commentId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Removes a comment. Only the comment owner or album creator can remove.
   */
  async removeComment(commentId: string, userId: number): Promise<void> {
    try {
      const comment = await this.commentRepository.findOne({ where: { id: commentId } })
      if (!comment) throw new NotFoundException('Comment not found')

      const photo = await this.photoRepository.findOne({ where: { id: comment.photoId } })
      const album = photo
        ? await this.albumRepository.findOne({ where: { id: photo.albumId } })
        : null

      if (comment.userId !== userId && album?.createdById !== userId) {
        throw new ForbiddenException(
          'Only the comment owner or album creator can delete this comment',
        )
      }

      await this.commentRepository.delete({ id: commentId })
    } catch (error) {
      this.logger.error(`Failed to remove comment ${commentId}`, error)
      this.errorLogsService.logError({
        message: `Failed to remove comment ${commentId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Toggles an emoji reaction on a comment. Each user can hold at most one reaction type at a time.
   * Calling with the same type removes it (toggle off). Calling with a different type switches it.
   */
  async toggleCommentReaction(
    commentId: string,
    userId: number,
    type: string,
  ): Promise<Record<string, CommentReactionEntry[]>> {
    try {
      const comment = await this.commentRepository.findOne({ where: { id: commentId } })
      if (!comment) throw new NotFoundException('Comment not found')

      const [userRow] = await this.commentRepository.manager.query<
        Array<{ first_name: string; last_name: string }>
      >(`SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1`, [userId])
      const userName = userRow
        ? `${userRow.first_name} ${userRow.last_name}`.trim()
        : String(userId)

      // Normalize existing data (handles legacy number[] format)
      const reactions = this.normalizeCommentReactions(
        comment.reactions,
        new Map([[userId, userName]]),
      )

      // Check if user already had this reaction type before removing
      const wasOnThisType = (reactions[type] ?? []).some((entry) => entry.id === userId)

      // Remove userId from any existing reaction type
      for (const key of Object.keys(reactions)) {
        reactions[key] = (reactions[key] ?? []).filter((entry) => entry.id !== userId)
      }

      if (!wasOnThisType) {
        reactions[type] = [...(reactions[type] ?? []), { id: userId, name: userName }]
      }

      await this.commentRepository.update({ id: commentId }, { reactions })

      return reactions
    } catch (error) {
      this.logger.error(`Failed to toggle reaction on comment ${commentId}`, error)
      this.errorLogsService.logError({
        message: `Failed to toggle reaction on comment ${commentId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── TRANSLATE ───────────────────────────────────────────────────────────

  /**
   * Translates a comment into all supported languages.
   * Uses on-demand translation without server-side caching — comments are short and infrequent.
   */
  async translateComment(commentId: string, userId: number): Promise<Record<string, string>> {
    try {
      const comment = await this.commentRepository.findOne({ where: { id: commentId } })
      if (!comment) throw new NotFoundException('Comment not found')

      const photo = await this.photoRepository.findOne({ where: { id: comment.photoId } })
      if (!photo) throw new NotFoundException('Photo not found')

      const album = await this.albumRepository.findOne({ where: { id: photo.albumId } })
      if (!album) throw new NotFoundException('Album not found')
      await this.assertAlbumAccess(album, userId)

      // Return cached translations from DB — avoids repeated AI calls
      if (comment.translations && Object.keys(comment.translations).length > 0) {
        return comment.translations
      }

      if (!this.translateService.isTranslatableContent(comment.text)) return {}

      const detectedLang = await this.translateService.detectLanguage(comment.text)
      if (detectedLang === 'unknown') return {}

      const targetLangs = ['en', 'vi', 'ja'].filter((lang) => lang !== detectedLang)
      const translations = await this.translateService.translateToMultiple(
        comment.text,
        detectedLang,
        targetLangs,
      )

      // Persist translations so subsequent requests skip AI entirely
      if (Object.keys(translations).length > 0) {
        await this.commentRepository.update({ id: commentId }, { translations })
      }

      return translations
    } catch (error) {
      this.logger.error(`Failed to translate comment ${commentId}`, error)
      this.errorLogsService.logError({
        message: `Failed to translate comment ${commentId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── SHARE ────────────────────────────────────────────────────────────────

  /**
   * Validates the user can view the photo and returns share payload.
   * Calls ChatService.sendPhotoShare() when available.
   */
  async shareToChat(userId: number, dto: SharePhotoDto): Promise<object> {
    try {
      const photo = await this.photoRepository.findOne({ where: { id: dto.photoId } })
      if (!photo) throw new NotFoundException('Photo not found')

      const album = await this.albumRepository.findOne({ where: { id: dto.albumId } })
      if (!album) throw new NotFoundException('Album not found')

      await this.assertAlbumAccess(album, userId)

      const room = await this.chatRoomService.findByUuid(dto.chatRoomId, userId)
      const sender = await this.usersService.findOne(userId)

      const photoUrl = photo.url.startsWith('/') ? photo.url : `/${photo.url}`
      const thumbnailUrl = (photo.thumbnailUrl ?? photo.url).startsWith('/')
        ? (photo.thumbnailUrl ?? photo.url)
        : `/${photo.thumbnailUrl ?? photo.url}`

      const parts: string[] = [photoUrl, thumbnailUrl, photo.caption ?? '', dto.message ?? '']
      const content = `[memories_photo](${parts.join('|')})`

      const broadcast = await this.chatService.sendMessage({
        roomId: room.id,
        userId,
        username: sender.full_name,
        avatar: sender.avatar ?? '',
        content,
      })

      this.chatGateway.broadcastMessage(room.id, broadcast)

      return broadcast
    } catch (error) {
      this.logger.error('Failed to share photo', error)
      this.errorLogsService.logError({
        message: 'Failed to share photo',
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Shares an entire album to a chat room as a clickable album card message.
   */
  async shareAlbumToChat(userId: number, dto: ShareAlbumDto): Promise<object> {
    try {
      const album = await this.albumRepository.findOne({ where: { id: dto.albumId } })
      if (!album) throw new NotFoundException('Album not found')

      await this.assertAlbumAccess(album, userId)

      const room = await this.chatRoomService.findByUuid(dto.chatRoomId, userId)
      const sender = await this.usersService.findOne(userId)

      let coverUrl = ''
      if (album.coverPhotoId) {
        const coverPhoto = await this.photoRepository.findOne({ where: { id: album.coverPhotoId } })
        if (coverPhoto) {
          const raw = coverPhoto.thumbnailUrl ?? coverPhoto.url
          coverUrl = raw.startsWith('/') ? raw : `/${raw}`
        }
      }

      if (!coverUrl) {
        const firstPhoto = await this.photoRepository.findOne({
          where: { albumId: album.id },
          order: { createdAt: 'ASC' },
        })
        if (firstPhoto) {
          const raw = firstPhoto.thumbnailUrl ?? firstPhoto.url
          coverUrl = raw.startsWith('/') ? raw : `/${raw}`
        }
      }

      const parts: string[] = [
        album.id,
        coverUrl,
        album.title,
        String(album.photoCount),
        album.eventType,
        dto.message ?? '',
      ]
      const content = `[memories_album](${parts.join('|')})`

      const broadcast = await this.chatService.sendMessage({
        roomId: room.id,
        userId,
        username: sender.full_name,
        avatar: sender.avatar ?? '',
        content,
      })

      this.chatGateway.broadcastMessage(room.id, broadcast)

      return broadcast
    } catch (error) {
      this.logger.error('Failed to share album', error)
      this.errorLogsService.logError({
        message: 'Failed to share album',
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── BULK SUMMARY ─────────────────────────────────────────────────────────

  /**
   * Returns reaction counts and the current user's reaction for every photo in an album.
   * Replaces N individual getReactions calls from the photo grid — 2 SQL queries total.
   */
  async getAlbumReactionsSummary(
    albumId: string,
    userId: number,
  ): Promise<{
    counts: Record<string, Record<string, number>>
    userReactions: Record<string, string | null>
  }> {
    try {
      const album = await this.albumRepository.findOne({ where: { id: albumId } })
      if (!album) throw new NotFoundException('Album not found')
      await this.assertAlbumAccess(album, userId)

      const photoIdRows = await this.photoRepository.manager.query<Array<{ id: string }>>(
        `SELECT id FROM memory_photos WHERE album_id = ?`,
        [albumId],
      )

      if (photoIdRows.length === 0) return { counts: {}, userReactions: {} }

      const photoIds = photoIdRows.map((row) => row.id)
      const placeholders = photoIds.map(() => '?').join(',')

      const countRows = await this.reactionRepository.manager.query<
        Array<{ photo_id: string; type: string; cnt: string }>
      >(
        `SELECT photo_id, type, COUNT(*) AS cnt
         FROM memory_reactions
         WHERE photo_id IN (${placeholders})
         GROUP BY photo_id, type`,
        photoIds,
      )

      const userRows = await this.reactionRepository.manager.query<
        Array<{ photo_id: string; type: string }>
      >(
        `SELECT photo_id, type FROM memory_reactions
         WHERE photo_id IN (${placeholders}) AND user_id = ?`,
        [...photoIds, userId],
      )

      const counts: Record<string, Record<string, number>> = {}
      for (const row of countRows) {
        counts[row.photo_id] ??= {}
        counts[row.photo_id][row.type] = Number(row.cnt)
      }

      const userReactions: Record<string, string | null> = {}
      for (const id of photoIds) userReactions[id] = null
      for (const row of userRows) userReactions[row.photo_id] = row.type

      return { counts, userReactions }
    } catch (error) {
      this.logger.error(`Failed to get reactions summary for album ${albumId}`, error)
      this.errorLogsService.logError({
        message: `Failed to get reactions summary for album ${albumId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  /**
   * Returns comment count per photo for an album.
   * Replaces N individual getComments calls from the photo grid — 1 SQL query total.
   */
  async getAlbumCommentCounts(albumId: string, userId: number): Promise<Record<string, number>> {
    try {
      const album = await this.albumRepository.findOne({ where: { id: albumId } })
      if (!album) throw new NotFoundException('Album not found')
      await this.assertAlbumAccess(album, userId)

      const rows = await this.commentRepository.manager.query<
        Array<{ photo_id: string; cnt: string }>
      >(
        `SELECT c.photo_id, COUNT(*) AS cnt
         FROM memory_comments c
         JOIN memory_photos p ON p.id = c.photo_id
         WHERE p.album_id = ?
         GROUP BY c.photo_id`,
        [albumId],
      )

      const result: Record<string, number> = {}
      for (const row of rows) result[row.photo_id] = Number(row.cnt)
      return result
    } catch (error) {
      this.logger.error(`Failed to get comment counts for album ${albumId}`, error)
      this.errorLogsService.logError({
        message: `Failed to get comment counts for album ${albumId}`,
        stackTrace: (error as Error).stack ?? null,
        path: 'memories',
      })
      throw error
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private async assertAlbumAccess(album: MemoryAlbum, userId: number): Promise<void> {
    if (album.privacy === Privacy.PUBLIC) return
    if (album.createdById === userId) return

    const [row] = await this.albumRepository.manager.query<[{ cnt: number }]>(
      `SELECT COUNT(*) AS cnt FROM memory_album_members WHERE album_id = ? AND user_id = ?`,
      [album.id, userId],
    )
    if (!Number(row?.cnt)) {
      throw new ForbiddenException('You do not have access to this album')
    }
  }

  private async setAlbumMembers(albumId: string, memberIds: string[]): Promise<void> {
    await this.albumRepository.manager.query(
      `DELETE FROM memory_album_members WHERE album_id = ?`,
      [albumId],
    )
    if (memberIds.length === 0) return
    const values = memberIds.map(() => '(?, ?)').join(',')
    const parameters = memberIds.flatMap((id) => [albumId, Number(id)])
    await this.albumRepository.manager.query(
      `INSERT INTO memory_album_members (album_id, user_id) VALUES ${values}`,
      parameters,
    )
  }

  private deleteFileFromDisk(fileUrl: string): void {
    try {
      const uploadsRoot = path.resolve(process.cwd(), 'uploads', 'memories')
      const filePath = path.resolve(process.cwd(), fileUrl.replace(/^\//, ''))

      if (!filePath.startsWith(uploadsRoot + path.sep)) {
        this.logger.warn(`Blocked suspicious file path: ${fileUrl}`)
        return
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch {
      this.logger.warn(`Could not delete file: ${fileUrl}`)
    }
  }

  private async buildCoverPhotoMap(albumIds: string[]): Promise<Map<string, string>> {
    if (albumIds.length === 0) return new Map()

    // ROW_NUMBER picks only the first (oldest) photo per album — avoids loading all photos
    const rows = await this.photoRepository.manager.query<
      Array<{ album_id: string; thumbnail_url: string | null; url: string }>
    >(
      `SELECT album_id, thumbnail_url, url
       FROM (
         SELECT album_id, thumbnail_url, url,
           ROW_NUMBER() OVER (PARTITION BY album_id ORDER BY created_at ASC) AS rn
         FROM memory_photos
         WHERE album_id IN (${albumIds.map(() => '?').join(',')})
       ) ranked
       WHERE rn = 1`,
      albumIds,
    )

    const map = new Map<string, string>()
    for (const row of rows) {
      map.set(row.album_id, row.thumbnail_url ?? row.url)
    }
    return map
  }

  private async fetchMembersInfo(
    memberIds: string[],
  ): Promise<{ id: string; name: string; avatar: string | null }[]> {
    if (!memberIds.length) return []
    const ids = memberIds.map(Number).filter((id) => !isNaN(id))
    if (!ids.length) return []

    const rows = await this.albumRepository.manager.query<
      Array<{ id: number; first_name: string; last_name: string; avatar: string | null }>
    >(`SELECT id, first_name, last_name, avatar FROM users WHERE id IN (?)`, [ids])

    const infoMap = new Map(
      rows.map((row) => [
        String(row.id),
        {
          id: String(row.id),
          name: `${row.first_name} ${row.last_name}`.trim(),
          avatar: row.avatar,
        },
      ]),
    )
    return memberIds.map((id) => infoMap.get(id) ?? { id, name: id, avatar: null })
  }

  private serializeAlbum(
    album: MemoryAlbum,
    coverPhotoUrl: string | null | undefined,
    members: { id: string; name: string; avatar: string | null }[],
    memberIds: string[],
  ): object {
    return {
      id: album.id,
      title: album.title,
      description: album.description ?? null,
      eventType: album.eventType,
      coverPhotoId: album.coverPhotoId ?? null,
      coverPhotoUrl: coverPhotoUrl ?? null,
      date: album.date,
      privacy: album.privacy,
      createdById: String(album.createdById),
      memberIds,
      members,
      photoCount: album.photoCount,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    }
  }

  private async serializeAlbumAsync(
    album: MemoryAlbum,
    coverPhotoUrl?: string | null,
  ): Promise<object> {
    const rows = await this.albumRepository.manager.query<Array<{ user_id: number }>>(
      `SELECT user_id FROM memory_album_members WHERE album_id = ?`,
      [album.id],
    )
    const memberIds = rows.map((row) => String(row.user_id))
    const members = await this.fetchMembersInfo(memberIds)
    return this.serializeAlbum(album, coverPhotoUrl, members, memberIds)
  }

  private serializePhoto(
    photo: MemoryPhoto,
    uploaderName?: string,
    uploaderAvatar?: string | null,
  ): object {
    return {
      id: photo.id,
      albumId: photo.albumId,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl ?? photo.url,
      caption: photo.caption ?? null,
      uploadedById: String(photo.uploadedById),
      uploadedByName: uploaderName ?? null,
      uploadedByAvatar: uploaderAvatar ?? null,
      width: photo.width ?? 0,
      height: photo.height ?? 0,
      size: photo.size,
      mimeType: photo.mimeType,
      createdAt: photo.createdAt,
    }
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common'
import type { Response } from 'express'
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express'
import { MemoriesService } from './memories.service'
import { CreateAlbumDto } from './dto/create-album.dto'
import { UpdateAlbumDto } from './dto/update-album.dto'
import { CreateCommentDto } from './dto/create-comment.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'
import { ToggleReactionDto } from './dto/toggle-reaction.dto'
import { SharePhotoDto } from './dto/share-photo.dto'
import { ShareAlbumDto } from './dto/share-album.dto'
import { UploadChunkDto, CompleteChunkUploadDto } from './dto/upload-chunk.dto'
import { QueryAlbumsDto } from './dto/query-albums.dto'
import { UpdateMembersDto } from './dto/update-members.dto'
import { memoriesMulterConfig, chunkMulterConfig } from './config/multer.config'
import { PermissionsGuard } from '@/modules/permissions/guards/permissions.guard'
import { Permissions } from '@/modules/permissions/decorators/permissions.decorator'
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator'
import { Public } from '@/modules/auth/decorators/public.decorator'

@Controller('memories')
@UseGuards(PermissionsGuard)
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  @Get('albums')
  @Permissions('all_privileges', 'read')
  async findAll(
    @CurrentUser() user: { id: number },
    @Query(new ValidationPipe({ transform: true })) query: QueryAlbumsDto,
  ) {
    const data = await this.memoriesService.findAll(user.id, query)
    return { success: true, data }
  }

  @Post('albums')
  @Permissions('all_privileges', 'create')
  async create(@CurrentUser() user: { id: number }, @Body(ValidationPipe) dto: CreateAlbumDto) {
    const data = await this.memoriesService.create(user.id, dto)
    return { success: true, data }
  }

  @Get('albums/:id')
  @Permissions('all_privileges', 'read')
  async findOne(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.findOne(id, user.id)
    return { success: true, data }
  }

  @Patch('albums/:id')
  @Permissions('all_privileges', 'update')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: UpdateAlbumDto,
  ) {
    const data = await this.memoriesService.update(id, user.id, dto)
    return { success: true, data }
  }

  @Patch('albums/:id/members')
  @Permissions('all_privileges', 'update')
  async updateMembers(
    @Param('id') id: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: UpdateMembersDto,
  ) {
    const data = await this.memoriesService.updateMembers(id, user.id, dto.memberIds ?? [])
    return { success: true, data }
  }

  @Delete('albums/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  async remove(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    await this.memoriesService.remove(id, user.id)
  }

  @Post('albums/:id/download-token')
  @Permissions('all_privileges', 'read')
  async createDownloadToken(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    return this.memoriesService.createDownloadToken(id, user.id)
  }

  @Get('albums/:id/download')
  @Public()
  async downloadAlbum(
    @Param('id') _id: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { stream, filename } = await this.memoriesService.downloadAlbum(token)
    const encoded = encodeURIComponent(filename)
    response.setHeader('Content-Type', 'application/zip')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new StreamableFile(stream as any)
  }

  @Get('albums/:id/reactions-summary')
  @Permissions('all_privileges', 'read')
  async getAlbumReactionsSummary(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.getAlbumReactionsSummary(id, user.id)
    return { success: true, data }
  }

  @Get('albums/:id/comments-count')
  @Permissions('all_privileges', 'read')
  async getAlbumCommentCounts(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.getAlbumCommentCounts(id, user.id)
    return { success: true, data }
  }

  @Get('albums/:id/photos')
  @Permissions('all_privileges', 'read')
  async findPhotos(
    @Param('id') albumId: string,
    @CurrentUser() user: { id: number },
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const data = await this.memoriesService.findPhotos(
      albumId,
      user.id,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, parseInt(limit, 10) || 50),
    )
    return { success: true, data }
  }

  @Post('albums/:id/photos/chunk')
  @Permissions('all_privileges', 'create')
  @UseInterceptors(FileInterceptor('chunk', chunkMulterConfig))
  async uploadChunk(
    @Param('id') albumId: string,
    @CurrentUser() user: { id: number },
    @UploadedFile() file: Express.Multer.File,
    @Body(new ValidationPipe({ transform: true })) dto: UploadChunkDto,
  ) {
    const data = await this.memoriesService.uploadChunk(albumId, user.id, file, dto)
    return { success: true, data }
  }

  @Post('albums/:id/photos/chunk/complete')
  @Permissions('all_privileges', 'create')
  async completeChunkUpload(
    @Param('id') albumId: string,
    @CurrentUser() user: { id: number },
    @Body(new ValidationPipe({ transform: true })) dto: CompleteChunkUploadDto,
  ) {
    const data = await this.memoriesService.completeChunkUpload(albumId, user.id, dto)
    return { success: true, data }
  }

  @Post('albums/:id/photos')
  @Permissions('all_privileges', 'create')
  @UseInterceptors(FilesInterceptor('files', 20, memoriesMulterConfig))
  async uploadPhotos(
    @Param('id') albumId: string,
    @CurrentUser() user: { id: number },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const data = await this.memoriesService.uploadPhotos(albumId, user.id, files)
    return { success: true, data }
  }

  @Get('albums/:id/viewers')
  @Permissions('all_privileges', 'read')
  async getAlbumViewers(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.getAlbumViewers(id, user.id)
    return { success: true, data }
  }

  @Post('photos/:id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'create')
  async recordPhotoView(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    await this.memoriesService.recordPhotoView(id, user.id)
  }

  @Delete('photos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  async removePhoto(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    await this.memoriesService.removePhoto(id, user.id)
  }

  @Get('photos/:id/reactions')
  @Permissions('all_privileges', 'read')
  async getReactions(@Param('id') photoId: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.getReactions(photoId, user.id)
    return { success: true, data }
  }

  @Post('photos/:id/reactions')
  @Permissions('all_privileges', 'create')
  async toggleReaction(
    @Param('id') photoId: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: ToggleReactionDto,
  ) {
    const data = await this.memoriesService.toggleReaction(photoId, user.id, dto.type)
    return { success: true, data }
  }

  @Get('photos/:id/comments')
  @Permissions('all_privileges', 'read')
  async getComments(@Param('id') photoId: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.getComments(photoId, user.id)
    return { success: true, data }
  }

  @Post('photos/:id/comments')
  @Permissions('all_privileges', 'create')
  async addComment(
    @Param('id') photoId: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: CreateCommentDto,
  ) {
    const data = await this.memoriesService.addComment(photoId, user.id, dto)
    return { success: true, data }
  }

  @Patch('comments/:id')
  @Permissions('all_privileges', 'update')
  async updateComment(
    @Param('id') id: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: UpdateCommentDto,
  ) {
    const data = await this.memoriesService.updateComment(id, user.id, dto)
    return { success: true, data }
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  async removeComment(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    await this.memoriesService.removeComment(id, user.id)
  }

  @Post('comments/:id/translate')
  @Permissions('all_privileges', 'read')
  async translateComment(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.translateComment(id, user.id)
    return { success: true, data }
  }

  @Post('comments/:id/react')
  @Permissions('all_privileges', 'create')
  async toggleCommentReaction(
    @Param('id') id: string,
    @Body(ValidationPipe) body: { type: string },
    @CurrentUser() user: { id: number },
  ) {
    return this.memoriesService.toggleCommentReaction(id, user.id, body.type)
  }

  @Post('share')
  @Permissions('all_privileges', 'create')
  async shareToChat(@CurrentUser() user: { id: number }, @Body(ValidationPipe) dto: SharePhotoDto) {
    const data = await this.memoriesService.shareToChat(user.id, dto)
    return { success: true, data }
  }

  @Get('albums/:id/album-comments')
  @Permissions('all_privileges', 'read')
  async getAlbumComments(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.getAlbumComments(id, user.id)
    return { success: true, data }
  }

  @Post('albums/:id/album-comments')
  @Permissions('all_privileges', 'create')
  async addAlbumComment(
    @Param('id') id: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: CreateCommentDto,
  ) {
    const data = await this.memoriesService.addAlbumComment(id, user.id, dto.text)
    return { success: true, data }
  }

  @Patch('album-comments/:id')
  @Permissions('all_privileges', 'update')
  async updateAlbumComment(
    @Param('id') id: string,
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: UpdateCommentDto,
  ) {
    const data = await this.memoriesService.updateAlbumComment(id, user.id, dto.text)
    return { success: true, data }
  }

  @Delete('album-comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('all_privileges', 'delete')
  async deleteAlbumComment(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    await this.memoriesService.deleteAlbumComment(id, user.id)
  }

  @Post('album-comments/:id/translate')
  @Permissions('all_privileges', 'read')
  async translateAlbumComment(@Param('id') id: string, @CurrentUser() user: { id: number }) {
    const data = await this.memoriesService.translateAlbumComment(id, user.id)
    return { success: true, data }
  }

  @Post('album-comments/:id/react')
  @Permissions('all_privileges', 'create')
  async toggleAlbumCommentReaction(
    @Param('id') id: string,
    @Body(ValidationPipe) body: { type: string },
    @CurrentUser() user: { id: number },
  ) {
    return this.memoriesService.toggleAlbumCommentReaction(id, user.id, body.type)
  }

  @Post('share-album')
  @Permissions('all_privileges', 'create')
  async shareAlbumToChat(
    @CurrentUser() user: { id: number },
    @Body(ValidationPipe) dto: ShareAlbumDto,
  ) {
    const data = await this.memoriesService.shareAlbumToChat(user.id, dto)
    return { success: true, data }
  }
}

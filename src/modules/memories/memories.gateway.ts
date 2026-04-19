import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'

interface JoinAlbumPayload {
  albumId: string
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'memories', path: '/ws' })
export class MemoriesGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(MemoriesGateway.name)

  @WebSocketServer()
  private server: Server

  handleDisconnect(client: Socket) {
    this.logger.log(`Memories client disconnected: ${client.id}`)
  }

  @SubscribeMessage('join_album')
  handleJoinAlbum(
    @MessageBody() payload: JoinAlbumPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `album_${payload.albumId}`
    client.join(room)
    this.logger.log(`Client ${client.id} joined ${room}`)
  }

  @SubscribeMessage('leave_album')
  handleLeaveAlbum(
    @MessageBody() payload: JoinAlbumPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `album_${payload.albumId}`
    client.leave(room)
    this.logger.log(`Client ${client.id} left ${room}`)
  }

  // ─── Broadcast helpers called from MemoriesService ───────────────────────

  broadcastPhotoCommentNew(albumId: string, photoId: string, comment: object): void {
    this.server.to(`album_${albumId}`).emit('photo_comment_new', { photoId, comment })
  }

  broadcastPhotoCommentUpdated(
    albumId: string,
    photoId: string,
    commentId: string,
    text: string,
  ): void {
    this.server.to(`album_${albumId}`).emit('photo_comment_updated', { photoId, commentId, text })
  }

  broadcastPhotoCommentDeleted(albumId: string, photoId: string, commentId: string): void {
    this.server.to(`album_${albumId}`).emit('photo_comment_deleted', { photoId, commentId })
  }

  broadcastAlbumCommentNew(albumId: string, comment: object): void {
    this.server.to(`album_${albumId}`).emit('album_comment_new', { albumId, comment })
  }

  broadcastAlbumCommentUpdated(albumId: string, commentId: string, text: string): void {
    this.server.to(`album_${albumId}`).emit('album_comment_updated', { albumId, commentId, text })
  }

  broadcastAlbumCommentDeleted(albumId: string, commentId: string): void {
    this.server.to(`album_${albumId}`).emit('album_comment_deleted', { albumId, commentId })
  }
}

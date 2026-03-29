import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserDepartment } from '@/modules/user_departments/entities/user_department.entity'

@WebSocketGateway({
  cors: { origin: '*' },
  path: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserDepartment)
    private readonly userDepartmentRepository: Repository<UserDepartment>,
  ) {}

  /**
   * Authenticates the connecting client using JWT and joins them to their company room.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as Record<string, string>).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        client.disconnect()
        return
      }

      const payload = this.jwtService.verify<{ id: number }>(token)

      const userDepartment = await this.userDepartmentRepository.findOne({
        where: { user_id: payload.id },
      })

      if (!userDepartment) {
        client.disconnect()
        return
      }

      const roomName = `company:${userDepartment.company_id}`
      await client.join(roomName)
      client.data.companyId = userDepartment.company_id
    } catch {
      client.disconnect()
    }
  }

  /**
   * Handles client disconnection.
   */
  handleDisconnect(_client: Socket): void {
    // Room cleanup is handled automatically by socket.io
  }

  /**
   * Emits a new request event to all users in the same company.
   */
  emitRequestCreated(companyId: number, request: unknown): void {
    this.server.to(`company:${companyId}`).emit('request:created', request)
  }

  /**
   * Emits a request updated event (approval/rejection/edit) to all users in the same company.
   */
  emitRequestUpdated(companyId: number, request: unknown): void {
    this.server.to(`company:${companyId}`).emit('request:updated', request)
  }
}

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import moment from 'moment'
import { MeetingsService } from './meetings.service'
import { MeetingParticipantRole } from './entities/meeting_participant.entity'
import { MeetingHostSchedulesService } from './meeting_host_schedules.service'
import { SpeechService } from './speech.service'
import { SlackChannelsService } from '@/modules/slack_channels/slack_channels.service'
import { FirebaseService } from '@/modules/firebase/firebase.service'
import { UsersService } from '@/modules/users/users.service'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

// Common Whisper hallucination patterns — generated when audio is silence/noise
const HALLUCINATION_PATTERNS = [
  /^(thanks? for watching[.!]?)+$/i,
  /^(please (like|subscribe|share)[.!]?)+$/i,
  /^(\[music\]|\[noise\]|\[silence\]|\[applause\]|\[laughter\])+$/i,
  /^(subtitles? (by|from)[^.]+[.!]?)+$/i,
  /^(you\s*)+$/i,
  /^(the\s+end[.!]?)+$/i,
  /^(this\s+is\s+a\s+(test|recording)[^.]*[.!]?)+$/i,
  /^(so\s+|um\s+|uh\s+)+$/i,
  /^(hello[.!]?\s*)+$/i,
  /^(bye[.!]?\s*)+$/i,
  /^(mmm+\s*)+$/i,
  /^(hm+\s*)+$/i,
  /^(thank(s|\s+you)?[.!]?\s*)+$/i,
  /^(okay[.!]?\s*)+$/i,
  /^(sure[.!]?\s*)+$/i,
  /^(yes[.!]?\s*)+$/i,
  /^(right[.!]?\s*)+$/i,
  /^(i\s+see[.!]?\s*)+$/i,
  /^(of\s+course[.!]?\s*)+$/i,
  /^(let's?\s+(start|begin|go|continue)[^.]*[.!]?)+$/i,
  /^(how\s+are\s+you[^.]*[.!]?)+$/i,
]

// Common filler/noise words in vi/ja that Whisper produces from silence
const FILLER_PATTERNS = [
  /^(\s*(dạ|vâng|ạ|à|ừ|ờ|ừm|ờm|hmm|mm|aha|ha)\s*[.!]?\s*)+$/i,
  /^(\s*(はい|ええ|うん|あの|えーっと|そうですか|わかりました)\s*[.!?]?\s*)+$/,
  // Short Japanese phrases that Whisper hallucinates from silence/noise
  /^(はい、?\s*(よろしく|おねがい|わかりま)[^。]*。?\s*)+$/,
]

function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim()

  // Too short to be meaningful
  if (trimmed.length < 3) return true

  // Detect 3+ consecutive repeated words
  const words = trimmed.split(/\s+/)

  for (let index = 0; index < words.length - 2; index++) {
    const word = words[index]!.toLowerCase().replace(/[^a-z]/g, '')

    if (
      word.length > 1 &&
      word === words[index + 1]!.toLowerCase().replace(/[^a-z]/g, '') &&
      word === words[index + 2]!.toLowerCase().replace(/[^a-z]/g, '')
    ) {
      return true
    }
  }

  // Detect known hallucination phrases
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  // Detect filler-only output (noise misrecognized as speech)
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  return false
}

interface JoinMeetingPayload {
  meetingId: number
  username: string
}

interface TransferHostPayload {
  meetingId: number
  toUserId: number
}

interface LeaveMeetingPayload {
  meetingId: number
}

interface CoHostTargetPayload {
  meetingId: number
  targetUserId: number
}

interface SpeakerStatePayload {
  meetingId: number
  enabled: boolean
}

interface SubtitlePartialPayload {
  id: string
  meetingId: number
  speakerId: number
  speakerName: string
  original: string
  language: string
}

interface AnnotationDrawPayload {
  meetingId: number
  id: string
  userId: number
  color: string
  lineWidth: number
  points: Array<{ x: number; y: number }>
  timestamp: number
}

interface AnnotationClearPayload {
  meetingId: number
}

interface VoteOptionPayload {
  id: string
  text: string
}

interface MeetingVotePayload {
  id: string
  createdBy: number
  creatorName: string
  question: string
  options: VoteOptionPayload[]
  type: 'single' | 'multiple' | 'story_point'
  votes: Record<number, string[]>
  participantIds: number[]
  status: 'active' | 'closed'
  createdAt: number
}

interface SubtitleUpdatePayload {
  id: string
  meetingId: number
  speakerId: number
  speakerName: string
  original: string
  language: string
  translations: Record<string, string>
  audioBase64: Record<string, string | null>
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'meeting', path: '/ws' })
export class MeetingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(MeetingsGateway.name)

  // meetingId → Map<socketId, { userId, username }>
  private readonly activeParticipants = new Map<
    number,
    Map<string, { userId: number; username: string }>
  >()

  // meetingId → Map<userId, speakerEnabled>
  private readonly speakerStates = new Map<number, Map<number, boolean>>()

  // socketId → queue of pending audio chunks (max 2 buffered to bound latency)
  private readonly audioQueue = new Map<string, Buffer[]>()
  private readonly processingAudio = new Set<string>()

  // meetingId → active votes (ephemeral, cleared when meeting resets)
  private readonly activeVotes = new Map<number, MeetingVotePayload[]>()

  // meetingId → userId of current runtime host (ephemeral, reset per session)
  private readonly runtimeHosts = new Map<number, number>()

  // meetingId → Set of co-host user IDs (ephemeral, reset per session)
  private readonly coHostUserIds = new Map<number, Set<number>>()

  // inviteId → pending call timeout entry (auto-expires after CALL_TIMEOUT_MS)
  private static readonly CALL_TIMEOUT_MS = 30_000

  private readonly inviteTimeouts = new Map<
    number,
    { meetingId: number; userId: number; userName: string; timer: ReturnType<typeof setTimeout> }
  >()

  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly hostSchedulesService: MeetingHostSchedulesService,
    private readonly speechService: SpeechService,
    private readonly slackChannelsService: SlackChannelsService,
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    private readonly errorLogsService: ErrorLogsService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, string>).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        client.disconnect()
        return
      }

      const payload = this.jwtService.verify<{ id: number }>(token)
      client.data.userId = payload.id
      this.logger.log(`Client connected: ${client.id} (userId=${payload.id})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
    this.processingAudio.delete(client.id)
    this.audioQueue.delete(client.id)

    // Remove from all meeting rooms
    for (const [meetingId, participants] of this.activeParticipants.entries()) {
      const participant = participants.get(client.id)

      if (participant) {
        participants.delete(client.id)
        this.speakerStates.get(meetingId)?.delete(participant.userId)
        this.server.to(`meeting_${meetingId}`).emit('participant_left', {
          userId: participant.userId,
          username: participant.username,
          meetingId,
        })

        this.meetingsService.recordLeave(meetingId, participant.userId).catch((error) => {
          this.logger.error('Failed to record participant leave', error)
          this.errorLogsService.logError({
            message: `Failed to record participant leave on disconnect: meetingId=${meetingId} userId=${participant.userId}`,
            stackTrace: (error as Error).stack ?? null,
            path: `meeting_${meetingId}`,
            userId: participant.userId,
          })
        })

        // Notify list page of updated live participants
        this.emitParticipantsUpdated(meetingId)

        // Auto-reset to scheduled when the last participant disconnects
        if (participants.size === 0) {
          this.activeVotes.delete(meetingId)
          this.runtimeHosts.delete(meetingId)
          this.coHostUserIds.delete(meetingId)
          this.meetingsService
            .resetToScheduled(meetingId)
            .then(() => {
              this.server.to('meetings_list').emit('meeting_status_changed', {
                meetingId,
                status: 'scheduled',
                activeUserIds: [],
              })
            })
            .catch((error) => {
              this.logger.error('Failed to reset meeting to scheduled on disconnect', error)
              this.errorLogsService.logError({
                message: `Failed to reset meeting to scheduled on disconnect: meetingId=${meetingId}`,
                stackTrace: (error as Error).stack ?? null,
                path: `meeting_${meetingId}`,
              })
            })
        }
      }
    }
  }

  @SubscribeMessage('join_meeting')
  async handleJoinMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinMeetingPayload,
  ) {
    // Use verified userId from JWT, not the client-supplied payload
    const userId = client.data.userId as number
    const roomName = `meeting_${payload.meetingId}`
    client.join(roomName)

    if (!this.activeParticipants.has(payload.meetingId)) {
      this.activeParticipants.set(payload.meetingId, new Map())
    }

    this.activeParticipants.get(payload.meetingId)!.set(client.id, {
      userId,
      username: payload.username,
    })

    const participants = Array.from(this.activeParticipants.get(payload.meetingId)!.values())

    // Auto-activate meeting when first participant joins
    if (participants.length === 1) {
      this.meetingsService
        .setActive(payload.meetingId)
        .then(async () => {
          const activeUserIds = Array.from(
            this.activeParticipants.get(payload.meetingId)?.values() ?? [],
          ).map((participant) => participant.userId)
          this.server.to('meetings_list').emit('meeting_status_changed', {
            meetingId: payload.meetingId,
            status: 'active',
            activeUserIds,
          })

          // Resolve scheduled host for today and set as runtime host.
          // When no schedule exists (null), fall back to the first joiner.
          const today = moment().format('YYYY-MM-DD')
          const scheduledHostId = await this.hostSchedulesService
            .resolveHostForDate(payload.meetingId, today)
            .catch(() => null)
          const resolvedHostId = scheduledHostId ?? userId
          this.runtimeHosts.set(payload.meetingId, resolvedHostId)
          this.server.to(`meeting_${payload.meetingId}`).emit('host_changed', {
            meetingId: payload.meetingId,
            hostUserId: resolvedHostId,
          })
        })
        .catch((error) => {
          this.logger.error('Failed to set meeting active', error)
          this.errorLogsService.logError({
            message: `Failed to set meeting active: meetingId=${payload.meetingId}`,
            stackTrace: (error as Error).stack ?? null,
            path: `meeting_${payload.meetingId}`,
          })
        })
    }

    // Initialise speaker states map for this meeting if not present
    if (!this.speakerStates.has(payload.meetingId)) {
      this.speakerStates.set(payload.meetingId, new Map())
    }

    // Default new joiner's speaker to enabled (they can override with speaker_state event)
    this.speakerStates.get(payload.meetingId)!.set(userId, true)

    // Build current speaker states snapshot for the joining user
    const speakerStatesSnapshot: Record<number, boolean> = {}

    for (const [participantUserId, enabled] of this.speakerStates
      .get(payload.meetingId)!
      .entries()) {
      speakerStatesSnapshot[participantUserId] = enabled
    }

    // Notify others
    client.to(roomName).emit('participant_joined', {
      userId,
      username: payload.username,
      meetingId: payload.meetingId,
    })

    // Send current participant list + speaker states + runtime host + co-hosts to the joining user
    // Lazy-load co-hosts from DB on first join, then track ephemerally
    if (!this.coHostUserIds.has(payload.meetingId)) {
      const coHostIds = await this.meetingsService
        .getCoHostUserIds(payload.meetingId)
        .catch((error) => {
          this.logger.error('Failed to load co-hosts for meeting', error)
          this.errorLogsService.logError({
            message: `Failed to load co-hosts for meeting: meetingId=${payload.meetingId}`,
            stackTrace: (error as Error).stack ?? null,
            path: `meeting_${payload.meetingId}`,
          })
          return []
        })
      this.coHostUserIds.set(payload.meetingId, new Set(coHostIds))
    }

    const coHostArray = Array.from(this.coHostUserIds.get(payload.meetingId) ?? [])

    client.emit('meeting_state', {
      meetingId: payload.meetingId,
      participants,
      speakerStates: speakerStatesSnapshot,
      hostUserId: this.runtimeHosts.get(payload.meetingId) ?? null,
      coHostUserIds: coHostArray,
    })

    // Send active votes so joining user sees ongoing votes
    const activeVotesList = this.activeVotes.get(payload.meetingId) ?? []

    if (activeVotesList.length > 0) {
      client.emit('votes_state', activeVotesList)
    }

    // Notify list page of updated live participants (covers 2nd, 3rd... joins)
    this.emitParticipantsUpdated(payload.meetingId)

    // Cancel any pending invite/auto-call timeouts for this user in this meeting.
    // Covers the race condition where: auto-call fires → user joins room directly
    // before the 30s window expires → timer would otherwise fire a missed_call
    // even though the user is already present.
    this.cancelUserInviteTimeouts(payload.meetingId, userId)

    this.logger.log(`User ${userId} joined meeting ${payload.meetingId}`)
  }

  @SubscribeMessage('leave_meeting')
  handleLeaveMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveMeetingPayload,
  ) {
    // Use verified userId from JWT, not the client-supplied payload
    const userId = client.data.userId as number
    const roomName = `meeting_${payload.meetingId}`
    client.leave(roomName)

    const leaving = this.activeParticipants.get(payload.meetingId)?.get(client.id)
    this.activeParticipants.get(payload.meetingId)?.delete(client.id)

    if (leaving) {
      this.speakerStates.get(payload.meetingId)?.delete(leaving.userId)
    }

    this.server.to(roomName).emit('participant_left', {
      userId,
      meetingId: payload.meetingId,
    })

    this.meetingsService.recordLeave(payload.meetingId, userId).catch((error) => {
      this.logger.error('Failed to record participant leave', error)
      this.errorLogsService.logError({
        message: `Failed to record participant leave: meetingId=${payload.meetingId} userId=${userId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `meeting_${payload.meetingId}`,
        userId,
      })
    })

    // Notify list page of updated live participants (covers mid-session leaves)
    this.emitParticipantsUpdated(payload.meetingId)

    // Auto-reset to scheduled when the last participant leaves
    const remaining = this.activeParticipants.get(payload.meetingId)?.size ?? 0

    if (remaining === 0) {
      this.runtimeHosts.delete(payload.meetingId)
      this.coHostUserIds.delete(payload.meetingId)
      this.meetingsService
        .resetToScheduled(payload.meetingId)
        .then(() => {
          this.server.to('meetings_list').emit('meeting_status_changed', {
            meetingId: payload.meetingId,
            status: 'scheduled',
            activeUserIds: [],
          })
        })
        .catch((error) => {
          this.logger.error('Failed to reset meeting to scheduled', error)
          this.errorLogsService.logError({
            message: `Failed to reset meeting to scheduled: meetingId=${payload.meetingId}`,
            stackTrace: (error as Error).stack ?? null,
            path: `meeting_${payload.meetingId}`,
          })
        })
    }
  }

  @SubscribeMessage('subscribe_meetings_list')
  handleSubscribeMeetingsList(@ConnectedSocket() client: Socket) {
    // Use verified userId from JWT for personal room subscription
    const userId = client.data.userId as number
    client.join('meetings_list')
    client.join(`user_${userId}`)
    this.logger.log(`Client ${client.id} subscribed to meetings_list and user_${userId}`)

    // Send current live state so client can show correct status without reload
    const liveState: Record<number, number[]> = {}

    for (const [meetingId, participants] of this.activeParticipants.entries()) {
      if (participants.size > 0) {
        liveState[meetingId] = Array.from(participants.values()).map(
          (participant) => participant.userId,
        )
      }
    }

    client.emit('meetings_live_state', liveState)
  }

  @SubscribeMessage('unsubscribe_meetings_list')
  handleUnsubscribeMeetingsList(@ConnectedSocket() client: Socket) {
    client.leave('meetings_list')
  }

  @SubscribeMessage('transfer_host')
  handleTransferHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TransferHostPayload,
  ) {
    // Use verified userId from JWT as the "from" user
    const userId = client.data.userId as number
    const currentRuntimeHost = this.runtimeHosts.get(payload.meetingId)

    // Only the current runtime host can transfer
    if (currentRuntimeHost !== userId) {
      client.emit('error', { message: 'Only the current host can transfer host rights' })

      return
    }

    const roomParticipants = this.activeParticipants.get(payload.meetingId)
    const targetIsPresent = roomParticipants
      ? Array.from(roomParticipants.values()).some(
          (participant) => participant.userId === payload.toUserId,
        )
      : false

    if (!targetIsPresent) {
      client.emit('error', { message: 'Target user is not in the meeting' })

      return
    }

    this.runtimeHosts.set(payload.meetingId, payload.toUserId)

    // If the new host was a co-host, remove co-host status
    const coHosts = this.coHostUserIds.get(payload.meetingId)
    if (coHosts?.has(payload.toUserId)) {
      coHosts.delete(payload.toUserId)
      this.server.to(`meeting_${payload.meetingId}`).emit('co_host_demoted', {
        meetingId: payload.meetingId,
        userId: payload.toUserId,
      })
      // Update DB role from co_host to participant (host is tracked via runtimeHosts)
      this.meetingsService
        .updateParticipantRole(
          payload.meetingId,
          payload.toUserId,
          MeetingParticipantRole.PARTICIPANT,
        )
        .catch((error) => {
          this.logger.error('Failed to update role after host transfer', error)
          this.errorLogsService.logError({
            message: `Failed to update role after host transfer: meetingId=${payload.meetingId} userId=${payload.toUserId}`,
            stackTrace: (error as Error).stack ?? null,
            path: `meeting_${payload.meetingId}`,
          })
        })
    }

    this.server.to(`meeting_${payload.meetingId}`).emit('host_changed', {
      meetingId: payload.meetingId,
      hostUserId: payload.toUserId,
    })

    this.logger.log(
      `Host transferred in meeting ${payload.meetingId}: ${userId} → ${payload.toUserId}`,
    )
  }

  @SubscribeMessage('promote_co_host')
  async handlePromoteCoHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CoHostTargetPayload,
  ) {
    const userId = client.data.userId as number
    const runtimeHostId = this.runtimeHosts.get(payload.meetingId)

    // Only the runtime host can promote to co-host
    if (runtimeHostId !== userId) {
      client.emit('error', { message: 'Only the host can promote to co-host' })
      return
    }

    // Cannot promote yourself
    if (payload.targetUserId === userId) {
      client.emit('error', { message: 'Cannot promote yourself to co-host' })
      return
    }

    // Target must be in the room
    const roomParticipants = this.activeParticipants.get(payload.meetingId)
    const targetParticipant = roomParticipants
      ? Array.from(roomParticipants.values()).find(
          (participant) => participant.userId === payload.targetUserId,
        )
      : undefined

    if (!targetParticipant) {
      client.emit('error', { message: 'Target user is not in the meeting' })
      return
    }

    try {
      // Update role in database
      await this.meetingsService.updateParticipantRole(
        payload.meetingId,
        payload.targetUserId,
        MeetingParticipantRole.CO_HOST,
      )
    } catch (error) {
      this.logger.error('Failed to promote co-host', error)
      this.errorLogsService.logError({
        message: `Failed to promote co-host: meetingId=${payload.meetingId} targetUserId=${payload.targetUserId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `meeting_${payload.meetingId}`,
      })
      client.emit('error', { message: 'Failed to promote co-host' })
      return
    }

    // Track ephemeral co-host state
    if (!this.coHostUserIds.has(payload.meetingId)) {
      this.coHostUserIds.set(payload.meetingId, new Set())
    }
    this.coHostUserIds.get(payload.meetingId)!.add(payload.targetUserId)

    // Broadcast to all participants
    this.server.to(`meeting_${payload.meetingId}`).emit('co_host_promoted', {
      meetingId: payload.meetingId,
      userId: payload.targetUserId,
      userName: targetParticipant.username,
    })

    this.logger.log(
      `User ${payload.targetUserId} promoted to co-host in meeting ${payload.meetingId} by ${userId}`,
    )
  }

  @SubscribeMessage('demote_co_host')
  async handleDemoteCoHost(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CoHostTargetPayload,
  ) {
    const userId = client.data.userId as number
    const runtimeHostId = this.runtimeHosts.get(payload.meetingId)

    // Only the runtime host can demote co-host
    if (runtimeHostId !== userId) {
      client.emit('error', { message: 'Only the host can demote co-host' })
      return
    }

    // Target must be a co-host
    const coHosts = this.coHostUserIds.get(payload.meetingId)
    if (!coHosts || !coHosts.has(payload.targetUserId)) {
      client.emit('error', { message: 'Target user is not a co-host' })
      return
    }

    try {
      // Update role in database
      await this.meetingsService.updateParticipantRole(
        payload.meetingId,
        payload.targetUserId,
        MeetingParticipantRole.PARTICIPANT,
      )
    } catch (error) {
      this.logger.error('Failed to demote co-host', error)
      this.errorLogsService.logError({
        message: `Failed to demote co-host: meetingId=${payload.meetingId} targetUserId=${payload.targetUserId}`,
        stackTrace: (error as Error).stack ?? null,
        path: `meeting_${payload.meetingId}`,
      })
      client.emit('error', { message: 'Failed to demote co-host' })
      return
    }

    // Remove from ephemeral co-host set
    coHosts.delete(payload.targetUserId)

    // Broadcast to all participants
    this.server.to(`meeting_${payload.meetingId}`).emit('co_host_demoted', {
      meetingId: payload.meetingId,
      userId: payload.targetUserId,
    })

    this.logger.log(
      `User ${payload.targetUserId} demoted from co-host in meeting ${payload.meetingId} by ${userId}`,
    )
  }

  @SubscribeMessage('end_meeting')
  async handleEndMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: number },
  ) {
    // Use verified userId from JWT
    const userId = client.data.userId as number
    const hostId = await this.meetingsService.findHostIdById(payload.meetingId).catch(() => null)

    const runtimeHostId = this.runtimeHosts.get(payload.meetingId)
    const isRuntimeHost = runtimeHostId === userId
    const isOwner = hostId === userId
    const isCoHost = this.coHostUserIds.get(payload.meetingId)?.has(userId) ?? false

    if (hostId === null || (!isRuntimeHost && !isOwner && !isCoHost)) {
      client.emit('error', { message: 'Only the host or co-host can end the meeting' })

      return
    }

    const roomName = `meeting_${payload.meetingId}`

    // Broadcast to everyone including host so all clients navigate away
    this.server.to(roomName).emit('meeting_ended', { meetingId: payload.meetingId })

    // Record leave for all active participants
    const participants = this.activeParticipants.get(payload.meetingId)

    if (participants) {
      for (const participant of participants.values()) {
        this.meetingsService.recordLeave(payload.meetingId, participant.userId).catch((error) => {
          this.logger.error('Failed to record leave on end_meeting', error)
          this.errorLogsService.logError({
            message: `Failed to record leave on end_meeting: meetingId=${payload.meetingId} userId=${participant.userId}`,
            stackTrace: (error as Error).stack ?? null,
            path: `meeting_${payload.meetingId}`,
            userId: participant.userId,
          })
        })
      }

      participants.clear()
    }

    this.speakerStates.get(payload.meetingId)?.clear()
    this.activeVotes.delete(payload.meetingId)
    this.runtimeHosts.delete(payload.meetingId)
    this.coHostUserIds.delete(payload.meetingId)

    // Reset status to scheduled
    this.meetingsService
      .resetToScheduled(payload.meetingId)
      .then(() => {
        this.server.to('meetings_list').emit('meeting_status_changed', {
          meetingId: payload.meetingId,
          status: 'scheduled',
          activeUserIds: [],
        })
      })
      .catch((error) => {
        this.logger.error('Failed to reset meeting to scheduled after end_meeting', error)
        this.errorLogsService.logError({
          message: `Failed to reset meeting to scheduled after end_meeting: meetingId=${payload.meetingId}`,
          stackTrace: (error as Error).stack ?? null,
          path: `meeting_${payload.meetingId}`,
        })
      })

    this.logger.log(`Meeting ${payload.meetingId} ended by host ${userId}`)
  }

  @SubscribeMessage('speaker_state')
  handleSpeakerState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SpeakerStatePayload,
  ) {
    // Use verified userId from JWT
    const userId = client.data.userId as number

    // Persist so new joiners receive current state in meeting_state snapshot
    if (!this.speakerStates.has(payload.meetingId)) {
      this.speakerStates.set(payload.meetingId, new Map())
    }

    this.speakerStates.get(payload.meetingId)!.set(userId, payload.enabled)

    // Broadcast to all other participants in the meeting room (excluding sender)
    client.to(`meeting_${payload.meetingId}`).emit('speaker_state', {
      userId,
      enabled: payload.enabled,
      meetingId: payload.meetingId,
    })
  }

  @SubscribeMessage('cursor_move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: number; x: number; y: number },
  ) {
    const userId = client.data.userId as number
    client.to(`meeting_${payload.meetingId}`).emit('cursor_move', { ...payload, userId })
  }

  @SubscribeMessage('cursor_hide')
  handleCursorHide(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: number },
  ) {
    const userId = client.data.userId as number
    client.to(`meeting_${payload.meetingId}`).emit('cursor_hide', { ...payload, userId })
  }

  @SubscribeMessage('screen_marker')
  handleScreenMarker(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      meetingId: number
      id: string
      x: number
      y: number
      color: string
      timestamp: number
    },
  ) {
    const userId = client.data.userId as number
    client.to(`meeting_${payload.meetingId}`).emit('screen_marker', { ...payload, userId })
  }

  @SubscribeMessage('screen_marker_clear')
  handleScreenMarkerClear(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { meetingId: number },
  ) {
    this.server.to(`meeting_${payload.meetingId}`).emit('screen_marker_clear')
  }

  @SubscribeMessage('audio_stream')
  handleAudioStream(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      meetingId: number
      audioData?: ArrayBuffer
      audioBase64?: string
      speakerLanguage?: string | null
      ttsEnabled?: boolean
      isScreenAudio?: boolean
    },
  ) {
    const participant = this.activeParticipants.get(payload.meetingId)?.get(client.id)
    if (!participant) return

    // Skip if previous chunk is still being processed — prevents queue buildup
    if (this.processingAudio.has(client.id)) return

    // Accept binary (preferred) or base64 (backward compat)
    const audioBuffer = payload.audioData
      ? Buffer.from(payload.audioData)
      : payload.audioBase64
        ? Buffer.from(payload.audioBase64, 'base64')
        : null

    if (!audioBuffer) return

    const speakerLanguage = payload.speakerLanguage ?? undefined
    const ttsEnabled = payload.ttsEnabled ?? false
    const isScreenAudio = payload.isScreenAudio ?? false

    // If already processing, buffer the chunk (keep max 2 to avoid growing queue)
    if (this.processingAudio.has(client.id)) {
      const queue = this.audioQueue.get(client.id) ?? []
      if (queue.length < 2) queue.push(audioBuffer)
      else queue[queue.length - 1] = audioBuffer // replace oldest buffered with newest
      this.audioQueue.set(client.id, queue)

      return
    }

    this.processingAudio.add(client.id)
    this.processAudioChunk(
      client,
      payload.meetingId,
      participant,
      audioBuffer,
      speakerLanguage,
      ttsEnabled,
      isScreenAudio,
    )
  }

  private processAudioChunk(
    client: Socket,
    meetingId: number,
    participant: { userId: number; username: string },
    audioBuffer: Buffer,
    speakerLanguage: string | undefined,
    ttsEnabled: boolean,
    isScreenAudio: boolean,
  ) {
    const subtitleId = `${participant.userId}-${moment().valueOf()}`

    ;(async () => {
      try {
        const { text, language } = await this.speechService.transcribeOnly(
          audioBuffer,
          speakerLanguage,
          isScreenAudio,
        )
        this.logger.log(
          `[whisper] text="${text}" lang=${language} words=${text ? text.trim().split(/\s+/).length : 0}`,
        )

        // Skip empty or too-short text
        // For CJK languages (no spaces), use character count (≥3 chars)
        // For space-separated languages, use word count (≥2 words)
        const hasCJK = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)
        const tooShort = hasCJK ? text.trim().length < 3 : text.trim().split(/\s+/).length < 2

        if (!text || tooShort || isWhisperHallucination(text)) {
          // Skip silently — too short, empty, or Whisper hallucination
        } else {
          this.logger.log(`[subtitle_partial] emitting to meeting_${meetingId}`)
          this.server.to(`meeting_${meetingId}`).emit('subtitle_partial', {
            id: subtitleId,
            meetingId,
            speakerId: participant.userId,
            speakerName: participant.username,
            original: text,
            language,
          } satisfies SubtitlePartialPayload)

          const { translations, audioBase64 } = await this.speechService.translateAndSynthesize(
            text,
            language,
            ['vi', 'en', 'ja'],
            ttsEnabled,
          )

          this.logger.log(
            `[subtitle_update] emitting to meeting_${meetingId} keys=${Object.keys(translations).join(',')}`,
          )
          this.broadcastSubtitleUpdate({
            id: subtitleId,
            meetingId,
            speakerId: participant.userId,
            speakerName: participant.username,
            original: text,
            language,
            translations,
            audioBase64,
          })
        }
      } catch (error) {
        this.logger.error('Audio chunk processing failed', error)
        this.errorLogsService.logError({
          message: `Audio chunk processing failed for meetingId=${meetingId} userId=${participant.userId}`,
          stackTrace: (error as Error).stack ?? null,
          path: `meeting_${meetingId}`,
          userId: participant.userId,
        })
        this.slackChannelsService.sendSystemError(
          `[Meeting] Audio chunk processing failed for meetingId=${meetingId} userId=${participant.userId}: ${(error as Error).message}`,
        )
      } finally {
        // Drain queued chunk if any
        const queue = this.audioQueue.get(client.id)
        if (queue && queue.length > 0) {
          const nextBuffer = queue.shift()!
          if (queue.length === 0) this.audioQueue.delete(client.id)
          this.processAudioChunk(
            client,
            meetingId,
            participant,
            nextBuffer,
            speakerLanguage,
            ttsEnabled,
            isScreenAudio,
          )
        } else {
          this.processingAudio.delete(client.id)
        }
      }
    })()
  }

  @SubscribeMessage('annotation_draw')
  handleAnnotationDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AnnotationDrawPayload,
  ) {
    // Replace client-supplied userId with JWT-verified identity to prevent spoofing
    const userId = client.data.userId as number
    client.to(`meeting_${payload.meetingId}`).emit('annotation_draw', { ...payload, userId })
  }

  @SubscribeMessage('annotation_clear')
  handleAnnotationClear(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: AnnotationClearPayload,
  ) {
    // Broadcast clear to all participants including sender for consistency
    this.server.to(`meeting_${payload.meetingId}`).emit('annotation_clear')
  }

  @SubscribeMessage('vote_create')
  handleVoteCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      meetingId: number
      creatorName: string
      question: string
      options: string[]
      type: 'single' | 'multiple' | 'story_point'
      participantIds: number[]
    },
  ) {
    // Use verified userId from JWT
    const userId = client.data.userId as number

    const vote: MeetingVotePayload = {
      id: `vote-${moment().valueOf()}-${Math.random().toString(36).slice(2, 7)}`,
      createdBy: userId,
      creatorName: payload.creatorName,
      question: payload.question,
      options: payload.options.map((text, index) => ({
        id: `opt-${index}`,
        text,
      })),
      type: payload.type,
      votes: {},
      participantIds: payload.participantIds,
      status: 'active',
      createdAt: moment().valueOf(),
    }

    if (!this.activeVotes.has(payload.meetingId)) {
      this.activeVotes.set(payload.meetingId, [])
    }

    this.activeVotes.get(payload.meetingId)!.push(vote)

    // Broadcast to all participants including sender
    this.server.to(`meeting_${payload.meetingId}`).emit('vote_started', vote)
  }

  @SubscribeMessage('vote_cast')
  handleVoteCast(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      meetingId: number
      voteId: string
      optionIds: string[]
    },
  ) {
    // Use verified userId from JWT
    const userId = client.data.userId as number

    const votes = this.activeVotes.get(payload.meetingId)
    if (!votes) return

    const vote = votes.find((value) => value.id === payload.voteId)
    if (!vote || vote.status !== 'active') return

    // Check if user is allowed to vote (empty participantIds = everyone)
    if (vote.participantIds.length > 0 && !vote.participantIds.includes(userId)) return

    const validIds = vote.options.map((option) => option.id)
    const selectedIds = payload.optionIds.filter((id) => validIds.includes(id))

    // Single choice: only one option allowed
    if (vote.type === 'single' && selectedIds.length > 1) return
    if (selectedIds.length === 0) return

    // Record or update vote (allows changing selection while vote is active)
    vote.votes[userId] = selectedIds

    // Broadcast updated vote to all participants
    this.server.to(`meeting_${payload.meetingId}`).emit('vote_updated', vote)
  }

  @SubscribeMessage('vote_close')
  handleVoteClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { meetingId: number; voteId: string },
  ) {
    // Use verified userId from JWT
    const userId = client.data.userId as number

    const votes = this.activeVotes.get(payload.meetingId)
    if (!votes) return

    const vote = votes.find((value) => value.id === payload.voteId)
    if (!vote || vote.status !== 'active') return

    // Only the creator can close the vote
    if (vote.createdBy !== userId) return

    vote.status = 'closed'

    this.server.to(`meeting_${payload.meetingId}`).emit('vote_ended', vote)
  }

  broadcastSubtitleUpdate(payload: SubtitleUpdatePayload) {
    this.server.to(`meeting_${payload.meetingId}`).emit('subtitle_update', {
      ...payload,
      timestamp: moment().valueOf(),
    })
  }

  /**
   * Emits a new_invite event to the invitee's personal room and broadcasts
   * invite_sent to all current meeting participants. Starts a 30s auto-miss timer.
   */
  emitNewInvite(
    userId: number,
    data: {
      meetingId: number
      meetingTitle: string
      meetingUuid: string
      inviteId: number
      userName: string
      invitedBy: number
    },
  ) {
    // Notify the invitee
    this.server.to(`user_${userId}`).emit('new_invite', {
      meetingId: data.meetingId,
      meetingTitle: data.meetingTitle,
      meetingUuid: data.meetingUuid,
    })

    // Notify everyone currently in the meeting room
    this.server.to(`meeting_${data.meetingId}`).emit('invite_sent', {
      userId,
      userName: data.userName,
    })

    // Cancel any previous timeout for the same invite (re-invite case)
    this.cancelInviteTimeout(data.inviteId)

    // Start 30-second auto-miss timer
    const timer = setTimeout(() => {
      this.inviteTimeouts.delete(data.inviteId)

      this.meetingsService.markInviteMissed(data.meetingId, userId).catch((error) => {
        this.logger.error(`Failed to mark invite ${data.inviteId} as missed`, error)
        this.errorLogsService.logError({
          message: `Failed to mark invite as missed: meetingId=${data.meetingId} inviteId=${data.inviteId} userId=${userId}`,
          stackTrace: (error as Error).stack ?? null,
          path: `meeting_${data.meetingId}`,
          userId,
        })
      })

      // Tell the invitee they missed the call (online path via socket)
      this.server.to(`user_${userId}`).emit('missed_call', {
        meetingId: data.meetingId,
        meetingTitle: data.meetingTitle,
        meetingUuid: data.meetingUuid,
        missedAt: moment().toISOString(),
      })

      // Tell the meeting room and the meetings index page that the call was missed
      const missedPayload = {
        meetingUuid: data.meetingUuid,
        userId,
        userName: data.userName,
        result: 'missed' as const,
      }
      this.server.to(`meeting_${data.meetingId}`).emit('invite_result', missedPayload)
      this.server.to('meetings_list').emit('invite_result', missedPayload)

      // Offline path: send FCM push so the user sees it even when the app is closed
      this.usersService
        .getFcmTokensForUsers([userId])
        .then((tokenMap) => {
          const token = tokenMap.get(userId)
          if (token) {
            this.firebaseService
              .sendToDevice(token, 'Missed call', data.meetingTitle, {
                url: `/meetings/${data.meetingUuid}`,
              })
              .catch((error) => {
                this.logger.warn(`FCM missed-call notification failed for user ${userId}: ${error}`)
              })
          }
        })
        .catch((error) => {
          this.logger.warn(`Failed to fetch FCM token for user ${userId}: ${error}`)
        })
    }, MeetingsGateway.CALL_TIMEOUT_MS)

    this.inviteTimeouts.set(data.inviteId, {
      meetingId: data.meetingId,
      userId,
      userName: data.userName,
      timer,
    })
  }

  /**
   * Cancels the auto-miss timer for an invite (called when the invitee responds).
   */
  cancelInviteTimeout(inviteId: number) {
    const entry = this.inviteTimeouts.get(inviteId)
    if (entry) {
      clearTimeout(entry.timer)
      this.inviteTimeouts.delete(inviteId)
    }
  }

  /**
   * Cancels ALL pending invite/auto-call timeouts for a user in a specific meeting.
   * Called when the user joins the meeting room — prevents stale missed_call events
   * from auto-call synthetic invite IDs that can never be cancelled via cancelInviteTimeout.
   */
  private cancelUserInviteTimeouts(meetingId: number, userId: number) {
    for (const [inviteId, entry] of this.inviteTimeouts.entries()) {
      if (entry.meetingId === meetingId && entry.userId === userId) {
        clearTimeout(entry.timer)
        this.inviteTimeouts.delete(inviteId)
      }
    }
  }

  /**
   * Notifies the invitee that the host cancelled their invite — dismiss call modal on client.
   */
  emitInviteCancelled(userId: number, meetingUuid: string) {
    this.server.to(`user_${userId}`).emit('invite_cancelled', { meetingUuid })
  }

  /**
   * Pushes a new scheduled participant invite to the invitee in real time.
   * The client adds it to the RSVP dialog without requiring a page refresh.
   */
  emitScheduledInvite(userId: number, invite: Record<string, unknown>) {
    this.server.to(`user_${userId}`).emit('scheduled_invite', invite)
  }

  /**
   * Notifies the invitee that the host removed their scheduled invite — dismiss RSVP dialog.
   */
  emitScheduledInviteRemoved(userId: number, meetingUuid: string) {
    this.server.to(`user_${userId}`).emit('scheduled_invite_removed', { meetingUuid })
  }

  /**
   * Notifies the meeting host that an invitee responded to a scheduled invite.
   * The host's manage-participants dialog updates the status in real time.
   */
  emitScheduledRsvpUpdated(
    hostId: number,
    data: { meetingUuid: string; userId: number; status: string },
  ) {
    this.server.to(`user_${hostId}`).emit('scheduled_rsvp_updated', data)
  }

  /**
   * Broadcasts the RSVP result (accepted / declined) to:
   * - All participants currently inside the meeting room (meeting_${meetingId})
   * - Everyone on the meetings index page (meetings_list) so the invite dialog refreshes
   *   regardless of which user originally created the invite.
   */
  emitInviteResult(
    meetingId: number,
    meetingUuid: string,
    userId: number,
    userName: string,
    result: 'accepted' | 'declined',
  ) {
    const payload = { meetingUuid, userId, userName, result }
    this.server.to(`meeting_${meetingId}`).emit('invite_result', payload)
    this.server.to('meetings_list').emit('invite_result', payload)
  }

  /**
   * Notifies a user that the auto-call config for a meeting was updated.
   * Sent to every scheduled participant so the manage-participants dialog
   * reflects the latest settings without a page reload.
   */
  emitAutoCallConfigUpdated(userId: number, data: { meetingUuid: string; config: unknown }) {
    this.server.to(`user_${userId}`).emit('auto_call_config_updated', data)
  }

  /** Returns the user IDs of participants currently connected to the meeting room. */
  getActiveUserIds(meetingId: number): Set<number> {
    const participants = this.activeParticipants.get(meetingId)
    if (!participants) return new Set()
    return new Set(Array.from(participants.values()).map((participant) => participant.userId))
  }

  private emitParticipantsUpdated(meetingId: number) {
    const activeUserIds = Array.from(this.activeParticipants.get(meetingId)?.values() ?? []).map(
      (participant) => participant.userId,
    )
    this.server.to('meetings_list').emit('meeting_participants_updated', {
      meetingId,
      activeUserIds,
    })
  }

  /**
   * Broadcasts a newly created meeting to all users on the meetings list page.
   */
  emitMeetingCreated(meeting: Record<string, unknown>) {
    this.server.to('meetings_list').emit('meeting_created', meeting)
  }

  /**
   * Broadcasts an updated meeting to all users on the meetings list page.
   */
  emitMeetingUpdated(meeting: Record<string, unknown>) {
    this.server.to('meetings_list').emit('meeting_updated', meeting)
  }

  /**
   * Notifies all users on the meetings list page that the host schedule for a meeting changed.
   */
  emitHostScheduleChanged(meetingUuid: string) {
    this.server.to('meetings_list').emit('host_schedule_changed', { meetingUuid })
  }
}

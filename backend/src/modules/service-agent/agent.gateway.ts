import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { BrowserAgentService } from './browser.agent.js';
import type { AgentTaskDto } from './agent-step.js';

@WebSocketGateway({
  namespace: 'agent',
  cors: { origin: '*', methods: ['GET', 'POST'] },
})
export class AgentGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AgentGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly agent: BrowserAgentService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    // JWT handshake required: client.io = io(url, { auth: { token: <jwt> } })
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers['authorization'] as string | undefined)?.replace(/^Bearer /i, '');

    let userId: number | null = null;
    try {
      const payload = this.jwtService.verify<{ sub: number }>(token ?? '', {
        algorithms: ['HS256'],
      });
      userId = payload?.sub ?? null;
    } catch {
      userId = null;
    }
    if (!userId) {
      this.logger.warn(`Agent socket rejected (unauthenticated): ${client.id}`);
      client.emit('auth_error', { message: 'Login required — connect with auth: { token }' });
      client.disconnect(true);
      return;
    }
    client.data.userId = userId;
    this.logger.log(`Agent client connected: ${client.id}`);
    client.emit('connected', { message: 'JanSetu browser agent ready', demoMode: true });
  }

  @SubscribeMessage('start_task')
  handleStartTask(@MessageBody() payload: AgentTaskDto, @ConnectedSocket() client: Socket): unknown {
    void this.agent
      .runTask(client, payload, client.data?.userId ?? null)
      .catch((err: Error) => client.emit('task_done', { error: err.message, trackingNumber: null }));
    return { accepted: true, message: 'Agent task accepted — steps stream via agent_step' };
  }

  @SubscribeMessage('captcha_solved')
  handleCaptchaSolved(@MessageBody() payload: { taskId?: string }): { accepted: boolean } {
    if (payload?.taskId) this.agent.handleCaptchaSolved(payload.taskId);
    return { accepted: true };
  }
}

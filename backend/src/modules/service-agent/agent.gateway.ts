import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
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

  constructor(private readonly agent: BrowserAgentService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Agent client connected: ${client.id}`);
    client.emit('connected', { message: 'CivicPulse browser agent ready', demoMode: true });
  }

  @SubscribeMessage('start_task')
  handleStartTask(@MessageBody() payload: AgentTaskDto, @ConnectedSocket() client: Socket): unknown {
    void this.agent
      .runTask(client, payload)
      .catch((err: Error) => client.emit('task_done', { error: err.message, trackingNumber: null }));
    return { accepted: true, message: 'Agent task accepted — steps stream via agent_step' };
  }

  @SubscribeMessage('captcha_solved')
  handleCaptchaSolved(@MessageBody() payload: { taskId?: string }): { accepted: boolean } {
    if (payload?.taskId) this.agent.handleCaptchaSolved(payload.taskId);
    return { accepted: true };
  }
}

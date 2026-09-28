import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Sse,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubscriptionQuotaGuard } from '../../common/guards/subscription-quota.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Observable } from 'rxjs';

@ApiTags('Chat Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @UseGuards(SubscriptionQuotaGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send prompt and receive AI response with provider routing' })
  @ApiResponse({ status: 200, description: 'AI response generated successfully' })
  @ApiResponse({ status: 403, description: 'Monthly quota exceeded or subscription inactive' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, dto);
  }

  @Sse('stream')
  @UseGuards(SubscriptionQuotaGuard)
  @ApiOperation({ summary: 'Server-Sent Events (SSE) real-time streaming response (Bonus)' })
  @ApiResponse({ status: 200, description: 'Token-by-token stream initiated' })
  async streamMessage(
    @CurrentUser('id') userId: string,
    @Query('prompt') prompt: string,
    @Query('conversationId') conversationId?: string,
    @Query('providerId') providerId?: string,
    @Query('model') model?: string,
  ): Promise<Observable<MessageEvent>> {
    const dto: SendMessageDto = {
      prompt,
      conversationId,
      providerId,
      model,
    };
    return this.chatService.streamMessage(userId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get paginated list of user conversation threads' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Conversations list returned' })
  async listConversations(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.chatService.listConversations(userId, pageNum, limitNum);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation thread' })
  @ApiResponse({ status: 201, description: 'Conversation thread created' })
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.createConversation(userId, dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get full message history of a specific conversation' })
  @ApiResponse({ status: 200, description: 'Conversation history returned' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.getConversation(userId, conversationId);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation thread and its message history' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.deleteConversation(userId, conversationId);
  }
}

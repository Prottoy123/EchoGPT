import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SendMessageZodSchema } from './chat.schema';

@ApiTags('Chat')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(SendMessageZodSchema))
  @ApiOperation({
    summary: 'Send prompt, route through Vercel AI SDK, and record history (Zod Validated)',
    description: `
### 🛡️ Zod Schema Validation Layer
- **Prompt Sanitization**: Strips leading/trailing whitespace, rejects whitespace-only queries, and enforces length bounds (1 to 4,000 characters) to prevent token overflow attacks.
- **UUID & Enum Verification**: Enforces UUID v4 validation on optional \`conversationId\` and strictly validates \`model\` against supported enum variants (\`OPENAI\`, \`CLAUDE\`, \`GEMINI\`).
- **Response Contract Validation**: Uses Zod to validate raw model outputs and guarantees runtime compliance of the outgoing response payload.

### ⚙️ How It Occurs in the Service
1. **Zod Validation Pipeline**: Validates incoming request body before any database queries. Rejects invalid requests immediately with HTTP 400 Bad Request and detailed field-level error diagnostics.
2. **Quota Gatekeeper**: Verifies \`user.requestsCount < user.subscription.requestLimit\`. Rejects immediately with HTTP 402 Payment Required if quota is exhausted.
3. **Conversation Management**: Automatically finds existing thread or spawns a new \`Conversation\` entity with title generated from initial prompt.
4. **AES-256-GCM Key Decryption**: Decrypts the target AI provider key (\`GEMINI\`, \`OPENAI\`, \`CLAUDE\`) in-memory. Plaintext keys are never logged or persisted.
5. **Context Window Assembly**: Fetches up to the last 10 conversational exchanges from PostgreSQL to provide context-aware responses.
6. **Unified AI SDK Orchestration**: Dispatches message payload to model (e.g. \`gemini-3-flash-preview\`, \`gpt-4o-mini\`).
7. **Graceful Upstream Fallbacks**: Catches upstream rate limits, quota limits, or invalid keys cleanly and formats a user-friendly notice without dropping the connection.
8. **Atomic Increment & Persistence**: Commits assistant response to \`Message\` table and increments \`User.requestsCount\` by 1.

### 📈 Future Scalability & Architecture Roadmap
* **Chunked Streaming**: Transition from synchronous JSON to Server-Sent Events (SSE) or WebSockets via \`streamText\` for real-time typewriter output.
* **Semantic Long-Term Memory (RAG)**: Index conversation history into \`pgvector\` to retrieve semantic context beyond the 10-message sliding window.
    `,
  })
  @ApiResponse({ status: 200, description: 'AI response generated and message thread updated' })
  @ApiResponse({ status: 400, description: 'Bad Request - Zod schema validation failed for prompt or parameters' })
  @ApiResponse({ status: 402, description: 'Monthly request limit exceeded. Upgrade subscription required.' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, dto);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Get paginated list of user conversation threads',
    description: `
### ⚙️ How It Occurs in the Service
1. **User Isolation**: Scopes query strictly to \`Conversation.userId = currentUserId\`.
2. **Metadata Aggregation**: Fetches thread titles, timestamps, total message counts, and snippet preview of the latest message.
3. **Pagination**: Applies efficient database \`skip\` and \`take\` pagination.

### 📈 Future Scalability & Architecture Roadmap
* **Keyset Pagination**: Migrate to cursor-based / keyset pagination (\`WHERE createdAt < cursor\`) for faster queries on high-volume message histories.
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated conversation threads' })
  async listConversations(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.chatService.listConversations(userId, pageNum, limitNum);
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Get full message history of a specific conversation',
    description: `
### ⚙️ How It Occurs in the Service
1. **Ownership Validation**: Validates that conversation exists and belongs to the requesting user.
2. **Chronological Retrieval**: Loads messages ordered by \`createdAt: 'asc'\`.
    `,
  })
  @ApiResponse({ status: 200, description: 'Complete message history for thread' })
  @ApiResponse({ status: 404, description: 'Conversation thread not found' })
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.getConversation(userId, conversationId);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete conversation thread and all nested messages',
    description: `
### ⚙️ How It Occurs in the Service
1. **Cascade Delete**: Deletes the parent \`Conversation\`. PostgreSQL foreign key cascading removes all related \`Message\` records atomically.
    `,
  })
  @ApiResponse({ status: 200, description: 'Conversation and all nested messages deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.deleteConversation(userId, conversationId);
  }
}

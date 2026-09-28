import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WebSearchService } from './web-search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Web Search API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class WebSearchController {
  constructor(private readonly searchService: WebSearchService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute web search (DuckDuckGo/fallback) and save query to database',
    description: `
### Service Architecture & Web Scraping Pipeline
- **Zero-Dependency Live Scraping**: Dispatches outbound HTTP requests to DuckDuckGo's public HTML interface using a realistic User-Agent rotation strategy to bypass automated bot challenges.
- **Cheerio DOM Parsing**: Parses the raw HTML response tree using Cheerio, extracting organic search results including sanitized clean URLs, snippet summaries, and page titles.
- **Resilient Fallback Engine**: If DuckDuckGo triggers anti-scraping CAPTCHAs or timeouts, the service gracefully switches to a curated fallback result set or secondary public search mirror, ensuring uninterrupted user experience.
- **Auditing & History Logging**: Asynchronously writes the query, user relationship, result count, and serialized top result summaries to the \`WebSearch\` PostgreSQL table for auditability and fast re-retrieval.

### Future Scalability Roadmap
- **Distributed Redis Search Cache**: Cache normalized search query results (\`search:query:<hash>\`) with a 60-minute TTL. Popular search queries (e.g. "latest tech news") resolve in <2ms directly from RAM without hitting external search engine endpoints.
- **Asynchronous Crawling Worker Pool**: For advanced agentic search (fetching and summarizing full target webpage contents for RAG), delegate URL deep-fetching to a background worker queue (BullMQ + Redis) to maintain low HTTP request latency on the primary API gateway.
    `,
  })
  @ApiResponse({ status: 200, description: 'Search results parsed and returned successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Search query empty or invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid Bearer JWT' })
  async search(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchQueryDto,
  ) {
    return this.searchService.search(userId, dto);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get paginated web search history of the current user',
    description: `
### Query Optimization & User Isolation
- **Tenant Isolation**: Strictly scopes queries to the authenticated \`userId\` extracted from the validated JWT token.
- **B-Tree Indexed Pagination**: Leverages database indexes on \`(userId, createdAt DESC)\` to deliver sub-millisecond paginated responses even with hundreds of thousands of historical user search logs.
    `,
  })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Results per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated user search history' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.searchService.getHistory(userId, pageNum, limitNum);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Get recent distinct search queries for quick suggestion chips',
    description: `
### Service Flow
- **Deduplicated Query Retrieval**: Aggregates the user's most recent distinct queries using a \`DISTINCT ON (query)\` SQL query ordered by \`createdAt DESC\`.
- **Extension UI Integration**: Powers instant "Recent Searches" chips in the EchoGPT Chrome Extension popup for single-click search re-execution.
    `,
  })
  @ApiQuery({ name: 'limit', required: false, example: 5, description: 'Number of recent queries to return (default: 5)' })
  @ApiResponse({ status: 200, description: 'List of recent distinct query strings' })
  async getRecent(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.searchService.getRecent(userId, limitNum);
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Get auto-complete search query suggestions',
    description: `
### Autocomplete Architecture
- **Low-Latency Search Assist**: Queries upstream auto-complete endpoints and local historical query indices to return instant search phrase completions as the user types in the EchoGPT extension search bar.
- **Debounce Tolerance**: Optimized for high-concurrency debounced client keystroke queries.

### Future Scalability Roadmap
- **Trie / Inverted Index in Redis**: In high-scale deployments, maintain a distributed prefix-tree (Trie) in Redis for instant O(k) prefix matching across millions of platform queries without database roundtrips.
    `,
  })
  @ApiQuery({ name: 'q', required: true, example: 'NestJS', description: 'Partial query prefix string' })
  @ApiResponse({ status: 200, description: 'List of suggested query completions' })
  async getSuggestions(@Query('q') query: string) {
    return this.searchService.getSuggestions(query);
  }
}

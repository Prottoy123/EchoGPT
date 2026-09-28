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
import { SubscriptionQuotaGuard } from '../../common/guards/subscription-quota.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Web Search API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class WebSearchController {
  constructor(private readonly searchService: WebSearchService) {}

  @Post('query')
  @UseGuards(SubscriptionQuotaGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute AI-assisted web search with result caching (Bonus)' })
  @ApiResponse({ status: 200, description: 'Web search results returned' })
  async search(
    @CurrentUser('id') userId: string,
    @Body() dto: SearchQueryDto,
  ) {
    return this.searchService.search(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get paginated web search history of the user' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Search history returned' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.searchService.getSearchHistory(userId, pageNum, limitNum);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent distinct search queries for quick suggestion' })
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiResponse({ status: 200, description: 'Recent searches returned' })
  async getRecent(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.searchService.getRecentSearches(userId, limitNum);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get auto-complete search query suggestions' })
  @ApiQuery({ name: 'q', required: true, example: 'quantum' })
  @ApiResponse({ status: 200, description: 'Search suggestions returned' })
  async getSuggestions(@Query('q') query: string) {
    return this.searchService.getSearchSuggestions(query);
  }
}

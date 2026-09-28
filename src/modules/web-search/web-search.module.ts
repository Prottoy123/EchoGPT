import { Module } from '@nestjs/common';
import { WebSearchService } from './web-search.service';
import { WebSearchController } from './web-search.controller';

@Module({
  controllers: [WebSearchController],
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}

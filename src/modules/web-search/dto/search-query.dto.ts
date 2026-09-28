import { IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  /**
   * Search terms or question to look up
   * @example latest developments in quantum computing
   */
  @IsString()
  @IsNotEmpty({ message: 'Search query cannot be empty' })
  query: string;

  /**
   * Maximum search results to return (1-20)
   * @example 5
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxResults?: number = 5;
}

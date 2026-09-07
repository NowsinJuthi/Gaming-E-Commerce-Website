import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get()
  instant(@Query() query: SearchQueryDto) {
    return this.search.instantSearch(query);
  }

  @Public()
  @Get('autocomplete')
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.search.autocomplete(query);
  }

  @Public()
  @Get('facets')
  facets(@Query() query: SearchQueryDto) {
    return this.search.facets(query);
  }
}

import { Global, Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { OrganisationsModule } from '../organisations/organisations.module';
import { UsersModule } from '../users/users.module';
import { SearchController } from './controllers/search.controller';
import { SearchIndexerService } from './services/search-indexer.service';
import { SearchQueryService } from './services/search-query.service';

@Global()
@Module({
  imports: [EventsModule, OrganisationsModule, UsersModule],
  controllers: [SearchController],
  providers: [SearchIndexerService, SearchQueryService],
  exports: [SearchIndexerService, SearchQueryService],
})
export class SearchModule {}

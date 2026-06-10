import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';
import { FeatureFlagsService } from '../platform/system-config/feature-flags.service';
import { SystemConfigService } from '../platform/system-config/system-config.service';

const SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending';

export interface GifPage {
  items: Array<Record<string, unknown>>;
  offset: number;
  total: number;
}

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}

interface GiphyGif {
  id?: string;
  title?: string;
  images?: { fixed_width?: GiphyImage; fixed_width_small?: GiphyImage };
}

@Injectable()
export class GiphyService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly features: FeatureFlagsService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async search(
    query: string,
    limit: number,
    offset: number,
    userId: string,
  ): Promise<GifPage> {
    if (!(await this.features.enabled('comments.giphy_picker', { userId }))) {
      return { items: [], offset, total: 0 };
    }

    return this.fetchPage(SEARCH_URL, { q: query }, limit, offset);
  }

  async trending(
    limit: number,
    offset: number,
    userId: string,
  ): Promise<GifPage> {
    if (!(await this.features.enabled('comments.giphy_picker', { userId }))) {
      return { items: [], offset, total: 0 };
    }

    return this.fetchPage(TRENDING_URL, {}, limit, offset);
  }

  private async fetchPage(
    url: string,
    extra: Record<string, string>,
    limit: number,
    offset: number,
  ): Promise<GifPage> {
    const key = this.config.get('GIPHY_API_KEY', { infer: true });

    if (!key) {
      return { items: [], offset, total: 0 };
    }

    const params = new URLSearchParams({
      api_key: key,
      limit: String(limit),
      offset: String(offset),
      rating: await this.systemConfig.string('providers.giphy_rating', 'pg-13'),
      bundle: 'messaging_non_clips',
      ...extra,
    });

    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      return { items: [], offset, total: 0 };
    }

    const payload = (await response.json()) as {
      data?: GiphyGif[];
      pagination?: { offset?: number; total_count?: number };
    };

    const items = (payload.data ?? []).flatMap((gif) => {
      const fixed = gif.images?.fixed_width;
      const preview = gif.images?.fixed_width_small ?? fixed;

      if (!fixed?.url || !gif.id) {
        return [];
      }

      return [
        {
          id: gif.id,
          title: gif.title ?? null,
          preview_url: preview?.url ?? fixed.url,
          url: fixed.url,
          width: Number(fixed.width ?? 0),
          height: Number(fixed.height ?? 0),
        },
      ];
    });

    return {
      items,
      offset: payload.pagination?.offset ?? offset,
      total: payload.pagination?.total_count ?? items.length,
    };
  }
}

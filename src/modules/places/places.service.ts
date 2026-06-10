import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';
import { FeatureFlagsService } from '../platform/system-config/feature-flags.service';
import { SystemConfigService } from '../platform/system-config/system-config.service';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';

export interface PlacePrediction {
  place_id: string;
  description: string;
}

export interface PlaceDetails {
  place_id: string;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

interface AddressComponent {
  types?: string[];
  longText?: string;
}

@Injectable()
export class PlacesService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly features: FeatureFlagsService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async search(
    query: string,
    userId: string,
    sessionToken?: string | null,
  ): Promise<PlacePrediction[]> {
    if (!(await this.features.enabled('places.search', { userId }))) {
      return [];
    }

    const key = this.config.get('GOOGLE_PLACES_API_KEY', { infer: true });

    if (!key) {
      return [];
    }

    const body: Record<string, unknown> = {
      input: query,
      includedRegionCodes: [
        await this.systemConfig.string('providers.places_region', 'ng'),
      ],
    };

    if (sessionToken) {
      body.sessionToken = sessionToken;
    }

    const response = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: { placeId?: string; text?: { text?: string } };
      }>;
    };

    return (payload.suggestions ?? []).flatMap((suggestion) => {
      const placeId = suggestion.placePrediction?.placeId ?? '';

      if (placeId === '') {
        return [];
      }

      return [
        {
          place_id: placeId,
          description: suggestion.placePrediction?.text?.text ?? '',
        },
      ];
    });
  }

  async details(
    placeId: string,
    sessionToken?: string | null,
  ): Promise<PlaceDetails | null> {
    const key = this.config.get('GOOGLE_PLACES_API_KEY', { infer: true });

    if (!key) {
      return null;
    }

    const query = sessionToken
      ? `?${new URLSearchParams({ sessionToken }).toString()}`
      : '';

    const response = await fetch(`${DETAILS_URL}${placeId}${query}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,location,addressComponents',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: AddressComponent[];
    };

    return {
      place_id: data.id ?? '',
      name: data.displayName?.text ?? null,
      address: data.formattedAddress ?? null,
      latitude: data.location?.latitude ?? null,
      longitude: data.location?.longitude ?? null,
      city: this.extractCity(data.addressComponents ?? []),
    };
  }

  private extractCity(components: AddressComponent[]): string | null {
    for (const type of [
      'locality',
      'postal_town',
      'administrative_area_level_2',
      'administrative_area_level_1',
    ]) {
      for (const component of components) {
        if ((component.types ?? []).includes(type)) {
          return component.longText ?? null;
        }
      }
    }

    return null;
  }
}

import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipEnvelope } from '../../../common/decorators/api-response.decorators';
import { Env } from '../../../config/env';
import { Public } from '../../auth/decorators/auth.decorators';

const UNIVERSAL_PATHS = [
  '/payments/return',
  '/payments/return*',
  '/events/*',
  '/orders/*',
];

@Public()
@SkipEnvelope()
@Controller({ path: '/', version: VERSION_NEUTRAL })
export class WellKnownController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get(['.well-known/apple-app-site-association', 'apple-app-site-association'])
  appleAppSiteAssociation(): Record<string, unknown> {
    const teamId = this.config.get('APPLE_TEAM_ID', { infer: true }) ?? '';
    const bundleId = this.config.get('IOS_BUNDLE_ID', { infer: true });
    const appId = teamId === '' ? null : `${teamId}.${bundleId}`;

    return {
      applinks: {
        apps: [],
        details:
          appId === null
            ? []
            : [
                {
                  appIDs: [appId],
                  components: UNIVERSAL_PATHS.map((path) => ({ '/': path })),
                },
              ],
      },
    };
  }

  @Get('.well-known/assetlinks.json')
  assetLinks(): unknown[] {
    const packageName = this.config.get('ANDROID_PACKAGE_NAME', {
      infer: true,
    });
    const fingerprints = this.config
      .get('ANDROID_SHA256_FINGERPRINTS', { infer: true })
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');

    if (packageName === '' || fingerprints.length === 0) {
      return [];
    }

    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ];
  }
}

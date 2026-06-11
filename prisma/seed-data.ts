export interface ReportReasonSeed {
  slug: string;
  label: string;
  description: string;
  scopeTypes: string[];
  requiresDetails: boolean;
}

export const REPORT_REASONS: ReadonlyArray<ReportReasonSeed> = [
  { slug: 'spam', label: 'Spam', description: 'Unwanted promotional or repetitive content.', scopeTypes: [], requiresDetails: false },
  { slug: 'harassment', label: 'Harassment', description: 'Bullying, targeted insults, or threats.', scopeTypes: [], requiresDetails: false },
  { slug: 'hate_speech', label: 'Hate speech', description: 'Attacks based on identity or protected characteristics.', scopeTypes: [], requiresDetails: false },
  { slug: 'violence', label: 'Violence', description: 'Encourages or glorifies violence or self-harm.', scopeTypes: [], requiresDetails: false },
  { slug: 'scam_or_fraud', label: 'Scam or fraud', description: 'Deceptive content trying to take money or data.', scopeTypes: [], requiresDetails: false },
  { slug: 'misinformation', label: 'Misinformation', description: 'Provably false claims presented as fact.', scopeTypes: [], requiresDetails: false },
  { slug: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else or another brand.', scopeTypes: [], requiresDetails: false },
  { slug: 'intellectual_property', label: 'Intellectual property', description: 'Unauthorised use of copyrighted or trademarked work.', scopeTypes: [], requiresDetails: false },
  { slug: 'nudity_or_sexual', label: 'Nudity or sexual content', description: 'Sexual content that is inappropriate or non-consensual.', scopeTypes: [], requiresDetails: false },
  { slug: 'fake_event', label: 'Fake event', description: 'Event does not exist or is misrepresented.', scopeTypes: ['event'], requiresDetails: false },
  { slug: 'event_cancelled_no_refund', label: 'Cancelled without refund', description: 'Event was cancelled and refunds were not honoured.', scopeTypes: ['event'], requiresDetails: false },
  { slug: 'underage_user', label: 'Underage user', description: 'User is under the platform minimum age.', scopeTypes: ['user'], requiresDetails: false },
  { slug: 'inappropriate_profile', label: 'Inappropriate profile', description: 'Profile photo, bio, or handle violates policy.', scopeTypes: ['user'], requiresDetails: false },
  { slug: 'other', label: 'Other', description: "Doesn't fit any of the above.", scopeTypes: [], requiresDetails: true },
];

export interface SystemConfigSeed {
  key: string;
  group: string;
  type: 'bool' | 'int' | 'decimal' | 'string' | 'json';
  default: string | number | boolean;
  description: string;
  isPublic?: boolean;
}

export const SYSTEM_CONFIGS: ReadonlyArray<SystemConfigSeed> = [
  { key: 'broadcasts.max_per_event', group: 'broadcasts', type: 'int', default: 3, description: 'Hard cap on broadcasts an organiser can send per event lifetime.' },
  { key: 'broadcasts.cooldown_minutes', group: 'broadcasts', type: 'int', default: 720, description: 'Minimum wait between consecutive broadcasts on the same event (minutes).' },
  { key: 'broadcasts.daily_volume_cap_per_org', group: 'broadcasts', type: 'int', default: 5000, description: 'Platform daily email cap per organisation.' },
  { key: 'broadcasts.chunk_size', group: 'broadcasts', type: 'int', default: 100, description: 'Recipients per dispatch job chunk.' },

  { key: 'orders.hold_ttl_minutes', group: 'orders', type: 'int', default: 10, description: 'Soft inventory hold while buyer is on checkout (minutes).', isPublic: true },
  { key: 'orders.fee_flat_minor', group: 'orders', type: 'int', default: 10000, description: 'Flat platform fee in minor units (kobo).', isPublic: true },
  { key: 'orders.fee_percentage_bps', group: 'orders', type: 'int', default: 300, description: 'Percentage platform fee in basis points (300 = 3%).', isPublic: true },
  { key: 'orders.items_per_quote_max', group: 'orders', type: 'int', default: 20, description: 'Max distinct ticket items per checkout.', isPublic: true },
  { key: 'orders.item_quantity_max', group: 'orders', type: 'int', default: 100, description: 'Max quantity for a single ticket line.', isPublic: true },

  { key: 'payouts.hold_window_days', group: 'payouts', type: 'int', default: 2, description: 'Days after order paid before revenue becomes available for payout.', isPublic: true },
  { key: 'payouts.bank_resolver', group: 'payouts', type: 'string', default: 'paystack', description: 'Provider used for bank account resolution.' },
  { key: 'payouts.transfer_fee_tier_1_naira', group: 'payouts', type: 'int', default: 5000, description: 'Paystack tier-1 ceiling (amounts ≤ this get the tier-1 transfer fee).', isPublic: true },
  { key: 'payouts.transfer_fee_tier_2_naira', group: 'payouts', type: 'int', default: 50000, description: 'Paystack tier-2 ceiling.', isPublic: true },
  { key: 'payouts.transfer_fee_tier_1_minor', group: 'payouts', type: 'int', default: 1000, description: 'Paystack transfer fee for tier-1 payouts (in minor units).', isPublic: true },
  { key: 'payouts.transfer_fee_tier_2_minor', group: 'payouts', type: 'int', default: 2500, description: 'Paystack transfer fee for tier-2 payouts (in minor units).', isPublic: true },
  { key: 'payouts.transfer_fee_tier_3_minor', group: 'payouts', type: 'int', default: 5000, description: 'Paystack transfer fee for tier-3 payouts (in minor units).', isPublic: true },

  { key: 'search.results_per_group_limit', group: 'search', type: 'int', default: 5, description: 'Results per category in mixed search.', isPublic: true },
  { key: 'search.per_page_default', group: 'search', type: 'int', default: 20, description: 'Default page size for feed / search pagination.', isPublic: true },
  { key: 'search.per_page_max', group: 'search', type: 'int', default: 50, description: 'Max page size for feed / search pagination.', isPublic: true },
  { key: 'search.giphy_page_size', group: 'search', type: 'int', default: 24, description: 'GIFs returned per page in the picker.', isPublic: true },
  { key: 'search.giphy_debounce_ms', group: 'search', type: 'int', default: 300, description: 'Debounce delay for GIF search input (ms).', isPublic: true },

  { key: 'feed.weight_interest', group: 'feed', type: 'decimal', default: 3.0, description: 'Weight for interest overlap in feed ranking.' },
  { key: 'feed.weight_subscribed', group: 'feed', type: 'decimal', default: 4.0, description: 'Weight for org subscription in feed ranking.' },
  { key: 'feed.weight_geo', group: 'feed', type: 'decimal', default: 2.0, description: 'Weight for geographic proximity in feed ranking.' },
  { key: 'feed.weight_time', group: 'feed', type: 'decimal', default: 2.0, description: 'Weight for time-to-event in feed ranking.' },
  { key: 'feed.weight_recency', group: 'feed', type: 'decimal', default: 0.5, description: 'Weight for publish recency in feed ranking.' },
  { key: 'feed.time_bonus_24h', group: 'feed', type: 'decimal', default: 1.0, description: 'Score multiplier for events starting within 24h.' },
  { key: 'feed.time_bonus_7d', group: 'feed', type: 'decimal', default: 0.7, description: 'Score multiplier for events starting within 7 days.' },
  { key: 'feed.time_bonus_30d', group: 'feed', type: 'decimal', default: 0.4, description: 'Score multiplier for events starting within 30 days.' },
  { key: 'feed.recency_bonus_7d', group: 'feed', type: 'decimal', default: 1.0, description: 'Score multiplier for events published within 7 days.' },
  { key: 'feed.recency_bonus_30d', group: 'feed', type: 'decimal', default: 0.4, description: 'Score multiplier for events published within 30 days.' },
  { key: 'feed.geo_distance_scale_km', group: 'feed', type: 'decimal', default: 50.0, description: 'Distance decay scale (km) for geo scoring.' },

  { key: 'auth.otp_ttl_minutes', group: 'auth', type: 'int', default: 10, description: 'OTP validity duration (minutes).', isPublic: true },
  { key: 'auth.otp_max_attempts', group: 'auth', type: 'int', default: 5, description: 'Max failed OTP attempts before expiry.', isPublic: true },
  { key: 'auth.otp_resend_cooldown_seconds', group: 'auth', type: 'int', default: 60, description: 'Cooldown between OTP resend requests.', isPublic: true },
  { key: 'auth.token_ttl_minutes', group: 'auth', type: 'int', default: 43200, description: 'API token expiration (minutes).' },
  { key: 'auth.stepup_challenge_ttl_minutes', group: 'auth', type: 'int', default: 15, description: 'Step-up challenge validity (minutes).' },
  { key: 'auth.stepup_factor_ttl_minutes', group: 'auth', type: 'int', default: 10, description: 'Step-up OTP factor validity (minutes).' },
  { key: 'auth.stepup_resend_cooldown_seconds', group: 'auth', type: 'int', default: 60, description: 'Cooldown between step-up OTP resends.', isPublic: true },
  { key: 'auth.stepup_max_attempts', group: 'auth', type: 'int', default: 5, description: 'Max failed step-up verification attempts.', isPublic: true },

  { key: 'reports.cooldown_seconds', group: 'reports', type: 'int', default: 30, description: 'Cooldown between reports from the same user.' },
  { key: 'reports.daily_cap_per_user', group: 'reports', type: 'int', default: 20, description: 'Max reports per day per user (abuse guardrail).' },

  { key: 'notifications.event_starting_soon_hours', group: 'notifications', type: 'int', default: 24, description: 'Hours before event start to send the reminder.' },

  { key: 'providers.giphy_rating', group: 'providers', type: 'string', default: 'pg-13', description: 'Giphy content-rating filter (g | pg | pg-13 | r).' },
  { key: 'providers.places_region', group: 'providers', type: 'string', default: 'ng', description: 'Google Places region bias (ISO country code).' },
];

export interface FeatureFlagSeed {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPct?: number;
  isPublic?: boolean;
}

export const FEATURE_FLAGS: ReadonlyArray<FeatureFlagSeed> = [
  { key: 'comments.enabled', description: 'Master switch for event comments. Disable to hide and refuse new posts.', enabled: true, isPublic: true },
  { key: 'comments.giphy_picker', description: 'GIF picker inside the comment composer. Kill switch for the Giphy dependency.', enabled: true, isPublic: true },
  { key: 'rsvp.enabled', description: 'Free RSVP on events. Disabling removes the RSVP button across the app.', enabled: true, isPublic: true },
  { key: 'places.search', description: 'Google Places autocomplete for event venue search. Kill switch for the Places dependency.', enabled: true, isPublic: true },
  { key: 'notifications.push', description: 'Expo push notifications. Kill switch when Expo is degraded.', enabled: true, isPublic: true },
  { key: 'broadcasts.enabled', description: 'Email broadcasts to ticket holders / RSVPs. Disable to halt new sends.', enabled: true, isPublic: true },
  { key: 'payouts.enabled', description: 'Organisers can request payouts. Disable to pause the payout workflow.', enabled: true, isPublic: true },
  { key: 'admin.system_announcements', description: 'Admin ability to broadcast platform-wide system announcements.', enabled: true, isPublic: false },
];

export const ORGANISATION_CATEGORIES: ReadonlyArray<{
  slug: string;
  name: string;
}> = [
  { slug: 'nightclub', name: 'Nightclub' },
  { slug: 'bar-lounge', name: 'Bar & Lounge' },
  { slug: 'concert-promoter', name: 'Concert Promoter' },
  { slug: 'festival-organizer', name: 'Festival Organizer' },
  { slug: 'event-planner', name: 'Event Planner' },
  { slug: 'restaurant-cafe', name: 'Restaurant & Café' },
  { slug: 'comedy-club', name: 'Comedy Club' },
  { slug: 'sports-fitness', name: 'Sports & Fitness' },
  { slug: 'conference-summit', name: 'Conference & Summit' },
  { slug: 'brand-activation', name: 'Brand & Activation' },
  { slug: 'community-group', name: 'Community Group' },
  { slug: 'religious-organization', name: 'Religious Organization' },
  { slug: 'school-alumni', name: 'School & Alumni' },
  { slug: 'artist-musician', name: 'Artist / Musician' },
  { slug: 'dj', name: 'DJ' },
  { slug: 'content-creator', name: 'Content Creator' },
  { slug: 'fashion-lifestyle', name: 'Fashion & Lifestyle' },
  { slug: 'nonprofit', name: 'Nonprofit' },
  { slug: 'venue', name: 'Venue' },
  { slug: 'ticketing-resale', name: 'Ticketing & Resale' },
];

export const SOCIAL_PLATFORMS: ReadonlyArray<{
  slug: string;
  name: string;
  baseUrl: string | null;
}> = [
  { slug: 'instagram', name: 'Instagram', baseUrl: 'https://instagram.com/' },
  { slug: 'x', name: 'X', baseUrl: 'https://x.com/' },
  { slug: 'tiktok', name: 'TikTok', baseUrl: 'https://tiktok.com/@' },
  { slug: 'snapchat', name: 'Snapchat', baseUrl: 'https://snapchat.com/add/' },
  { slug: 'facebook', name: 'Facebook', baseUrl: 'https://facebook.com/' },
  { slug: 'youtube', name: 'YouTube', baseUrl: 'https://youtube.com/@' },
  { slug: 'whatsapp', name: 'WhatsApp', baseUrl: 'https://wa.me/' },
  { slug: 'telegram', name: 'Telegram', baseUrl: 'https://t.me/' },
  { slug: 'threads', name: 'Threads', baseUrl: 'https://threads.net/@' },
  { slug: 'website', name: 'Website', baseUrl: null },
];

export const INTERESTS: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: 'afrobeats', name: 'Afrobeats' },
  { slug: 'amapiano', name: 'Amapiano' },
  { slug: 'hip-hop', name: 'Hip-Hop' },
  { slug: 'afro-house', name: 'Afro House' },
  { slug: 'alte', name: 'Alté' },
  { slug: 'rb-soul', name: 'R&B & Soul' },
  { slug: 'gospel', name: 'Gospel' },
  { slug: 'live-music', name: 'Live Music' },
  { slug: 'dj-sets', name: 'DJ Sets' },
  { slug: 'concerts', name: 'Concerts' },
  { slug: 'festivals', name: 'Festivals' },
  { slug: 'parties', name: 'Parties' },
  { slug: 'day-parties', name: 'Day Parties' },
  { slug: 'club-nights', name: 'Club Nights' },
  { slug: 'brunch', name: 'Brunch' },
  { slug: 'food-drink', name: 'Food & Drink' },
  { slug: 'comedy', name: 'Comedy' },
  { slug: 'theatre', name: 'Theatre' },
  { slug: 'art-exhibitions', name: 'Art & Exhibitions' },
  { slug: 'fashion', name: 'Fashion' },
  { slug: 'film-screenings', name: 'Film & Screenings' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'gaming-esports', name: 'Gaming & Esports' },
  { slug: 'tech-networking', name: 'Tech & Networking' },
  { slug: 'wellness', name: 'Wellness' },
  { slug: 'fitness', name: 'Fitness' },
  { slug: 'outdoors', name: 'Outdoors' },
  { slug: 'karaoke', name: 'Karaoke' },
  { slug: 'spoken-word', name: 'Spoken Word' },
  { slug: 'cultural-heritage', name: 'Cultural & Heritage' },
];

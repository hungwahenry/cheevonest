export interface EntityRef {
  type: string;
  id: string;
  label: string;
  sublabel?: string | null;
  thumbnail?: string | null;
  deep_link?: string | null;
}

export interface Stat {
  label: string;
  value: number;
  format: 'money' | 'int' | 'pct' | 'text';
}

export interface TimelineEntry {
  type: string;
  at: string;
  actor?: EntityRef | null;
  summary: string;
  refs?: EntityRef[];
}

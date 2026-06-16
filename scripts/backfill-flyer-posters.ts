/**
 * Dev-only, one-time: generate a poster frame for every existing video flyer
 * that doesn't have one yet, so the apps render cleanly for screenshots.
 *
 * Prereq: the flyer_poster_path column must exist (run `npm run db:deploy` first).
 * Storage is local in dev, so we read/write files straight from STORAGE_DIR.
 *
 * Run:  npx tsx scripts/backfill-flyer-posters.ts
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { ulid } from 'ulid';
import { PrismaClient } from '../src/generated/prisma/client';

const STORAGE_ROOT = resolve(process.env.STORAGE_DIR ?? 'storage/public');

/** Strip the `local:`/`s3:` disk prefix and resolve to an on-disk path. */
function localPath(ref: string): string {
  const sep = ref.indexOf(':');
  const prefix = sep === -1 ? '' : ref.slice(0, sep);
  const path = prefix === 'local' || prefix === 's3' ? ref.slice(sep + 1) : ref;
  return join(STORAGE_ROOT, path);
}

function extractFrame(video: string, out: string): boolean {
  const variants = [
    ['-y', '-ss', '1', '-i', video, '-frames:v', '1', '-vf', 'scale=1080:-1', '-q:v', '3', out],
    ['-y', '-i', video, '-frames:v', '1', '-vf', 'scale=1080:-1', '-q:v', '3', out],
  ];
  for (const args of variants) {
    try {
      execFileSync('ffmpeg', args, { stdio: 'ignore' });
      if (statSync(out).size > 0) return true;
    } catch {
      // try the next variant
    }
  }
  return false;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main(): Promise<void> {
  const events = await prisma.event.findMany({
    where: { flyerType: 'video', flyerPath: { not: null }, flyerPosterPath: null },
    select: { id: true, title: true, flyerPath: true },
  });

  console.log(`Found ${events.length} video flyer(s) without a poster.`);
  mkdirSync(join(STORAGE_ROOT, 'flyers'), { recursive: true });

  let done = 0;
  for (const event of events) {
    const video = localPath(event.flyerPath as string);

    try {
      statSync(video);
    } catch {
      console.warn(`  skip "${event.title}" — video missing at ${video}`);
      continue;
    }

    const posterRef = `local:flyers/${ulid().toLowerCase()}.jpg`;
    if (!extractFrame(video, localPath(posterRef))) {
      console.warn(`  ✗ "${event.title}" — ffmpeg could not extract a frame`);
      continue;
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { flyerPosterPath: posterRef },
    });
    done += 1;
    console.log(`  ✓ "${event.title}" -> ${posterRef}`);
  }

  console.log(`Done. Generated ${done}/${events.length} poster(s).`);
  await prisma.$disconnect();
}

void main();

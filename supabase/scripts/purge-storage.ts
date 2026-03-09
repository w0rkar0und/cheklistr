/**
 * Purge all files from submission-related storage buckets.
 *
 * Supabase prevents direct SQL deletes on storage.objects, so this script
 * uses the Storage API to list and remove files from each bucket.
 *
 * Usage:
 *   npx tsx supabase/scripts/purge-storage.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars,
 * or a .env file in the repo root.
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('Set them in your environment or in a .env file at the repo root.');
  process.exit(1);
}

const BUCKETS = ['vehicle-photos', 'defect-photos', 'checklist-photos'];

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function emptyBucket(bucket: string): Promise<number> {
  // List all objects in the bucket (paginated, up to 10 000)
  let deleted = 0;
  let hasMore = true;
  const limit = 1000;

  while (hasMore) {
    const listRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${bucket}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ prefix: '', limit, offset: 0 }),
      }
    );

    if (!listRes.ok) {
      const err = await listRes.text();
      console.error(`  ✗ Failed to list ${bucket}: ${listRes.status} ${err}`);
      return deleted;
    }

    const objects: { name: string }[] = await listRes.json();
    if (objects.length === 0) {
      hasMore = false;
      break;
    }

    // Storage objects may be in subdirectories — we need to list recursively.
    // Top-level items with no extension are likely folders (submission ID dirs).
    // We'll collect all file paths by listing each folder.
    const filePaths: string[] = [];

    for (const obj of objects) {
      // Check if it's a folder (no extension, or metadata says so)
      // List contents of this folder
      const subRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/list/${bucket}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ prefix: obj.name, limit: 100, offset: 0 }),
        }
      );

      if (subRes.ok) {
        const subObjects: { name: string }[] = await subRes.json();
        if (subObjects.length > 0) {
          // It's a folder — add subfiles
          for (const sub of subObjects) {
            filePaths.push(`${obj.name}/${sub.name}`);
          }
        } else {
          // It's a file at root level
          filePaths.push(obj.name);
        }
      }
    }

    if (filePaths.length === 0) {
      hasMore = false;
      break;
    }

    // Delete in batches
    const delRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}`,
      {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ prefixes: filePaths }),
      }
    );

    if (!delRes.ok) {
      const err = await delRes.text();
      console.error(`  ✗ Failed to delete from ${bucket}: ${delRes.status} ${err}`);
      hasMore = false;
    } else {
      const result = await delRes.json();
      const count = Array.isArray(result) ? result.length : filePaths.length;
      deleted += count;
      console.log(`  Deleted ${count} files`);
    }

    // If we got fewer than the limit, we've reached the end
    if (objects.length < limit) {
      hasMore = false;
    }
  }

  return deleted;
}

async function main() {
  console.log('Purging submission storage buckets…\n');

  let totalDeleted = 0;

  for (const bucket of BUCKETS) {
    console.log(`Bucket: ${bucket}`);
    const count = await emptyBucket(bucket);
    totalDeleted += count;
    console.log(`  → ${count} files removed\n`);
  }

  console.log(`Done. ${totalDeleted} total files removed.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

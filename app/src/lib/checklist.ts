import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessTokenFromStorage } from './supabase';
import { cacheChecklist, getCachedChecklist } from './offlineDb';
import type {
  Checklist,
  ChecklistVersion,
  ChecklistSection,
  ChecklistItem,
  FullChecklistVersion,
} from '../types/database';

/**
 * Helper: raw PostgREST fetch that bypasses the Supabase JS client.
 * The JS client can hang in Capacitor WebView when its internal auth
 * session is mid-refresh; raw fetch with an explicit token avoids this.
 */
async function postgrestFetch<T>(
  path: string,
): Promise<{ data: T | null; error: string | null }> {
  const accessToken = getAccessTokenFromStorage();
  if (!accessToken) {
    return { data: null, error: 'Not authenticated' };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[CHECKLIST] PostgREST error:', res.status, errText);
    return { data: null, error: `Request failed (${res.status})` };
  }

  const data = await res.json();
  return { data: data as T, error: null };
}

/**
 * Fetch the currently active checklist and its active version
 * with all sections and items, ordered by display_order.
 *
 * Uses raw PostgREST fetch (not the Supabase JS client) to avoid
 * session-hang issues inside Capacitor WebView.
 */
export async function fetchActiveChecklist(): Promise<{
  checklist: Checklist | null;
  version: FullChecklistVersion | null;
  error: string | null;
}> {
  // 1. Get the active checklist
  const { data: checklists, error: clError } = await postgrestFetch<Checklist[]>(
    'checklists?is_active=eq.true&limit=1',
  );

  if (clError || !checklists?.length) {
    return {
      checklist: null,
      version: null,
      error: clError ?? 'No active checklist found',
    };
  }

  const checklist = checklists[0];

  // 2. Get the active version for this checklist
  const { data: versions, error: vError } = await postgrestFetch<ChecklistVersion[]>(
    `checklist_versions?checklist_id=eq.${encodeURIComponent(checklist.id)}&is_active=eq.true&limit=1`,
  );

  if (vError || !versions?.length) {
    return {
      checklist,
      version: null,
      error: vError ?? 'No active checklist version found',
    };
  }

  const version = versions[0];

  // 3. Get sections for this version, ordered
  const { data: sections, error: sError } = await postgrestFetch<ChecklistSection[]>(
    `checklist_sections?checklist_version_id=eq.${encodeURIComponent(version.id)}&order=display_order.asc`,
  );

  if (sError || !sections) {
    return {
      checklist,
      version: null,
      error: sError ?? 'Failed to load checklist sections',
    };
  }

  // 4. Get all items for these sections, ordered
  const sectionIds = sections.map((s) => s.id);
  const { data: items, error: iError } = await postgrestFetch<ChecklistItem[]>(
    `checklist_items?section_id=in.(${sectionIds.map(encodeURIComponent).join(',')})&order=display_order.asc`,
  );

  if (iError || !items) {
    return {
      checklist,
      version: null,
      error: iError ?? 'Failed to load checklist items',
    };
  }

  // 5. Assemble the full version with nested sections → items
  const itemsBySection = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const existing = itemsBySection.get(item.section_id) ?? [];
    existing.push(item);
    itemsBySection.set(item.section_id, existing);
  }

  const fullVersion: FullChecklistVersion = {
    ...version,
    sections: sections.map((section) => ({
      ...section,
      items: itemsBySection.get(section.id) ?? [],
    })),
  };

  // Cache the checklist for offline use
  try {
    await cacheChecklist(checklist, fullVersion);
    console.log('[CHECKLIST] Cached checklist for offline use');
  } catch (cacheErr) {
    console.error('[CHECKLIST] Failed to cache checklist:', cacheErr);
  }

  return { checklist, version: fullVersion, error: null };
}

/**
 * Attempt to load the checklist from IndexedDB cache.
 * Used as a fallback when the network fetch fails.
 */
export async function fetchCachedChecklist(): Promise<{
  checklist: Checklist | null;
  version: FullChecklistVersion | null;
  error: string | null;
}> {
  try {
    const cached = await getCachedChecklist();
    if (cached) {
      console.log('[CHECKLIST] Loaded from offline cache (cached at', cached.cachedAt, ')');
      return { checklist: cached.checklist, version: cached.version, error: null };
    }
    return { checklist: null, version: null, error: 'No cached checklist available' };
  } catch (err) {
    return { checklist: null, version: null, error: 'Failed to read checklist cache' };
  }
}

import { supabase } from './supabase';
import { cacheChecklist, getCachedChecklist } from './offlineDb';
import type {
  Checklist,
  ChecklistVersion,
  ChecklistSection,
  ChecklistItem,
  FullChecklistVersion,
} from '../types/database';

/**
 * Fetch the currently active checklist and its active version
 * with all sections and items, ordered by display_order.
 */
export async function fetchActiveChecklist(): Promise<{
  checklist: Checklist | null;
  version: FullChecklistVersion | null;
  error: string | null;
}> {
  // 1. Get the active checklist
  const { data: checklists, error: clError } = await supabase
    .from('checklists')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  if (clError || !checklists?.length) {
    return {
      checklist: null,
      version: null,
      error: clError?.message ?? 'No active checklist found',
    };
  }

  const checklist = checklists[0] as Checklist;

  // 2. Get the active version for this checklist
  const { data: versions, error: vError } = await supabase
    .from('checklist_versions')
    .select('*')
    .eq('checklist_id', checklist.id)
    .eq('is_active', true)
    .limit(1);

  if (vError || !versions?.length) {
    return {
      checklist,
      version: null,
      error: vError?.message ?? 'No active checklist version found',
    };
  }

  const version = versions[0] as ChecklistVersion;

  // 3. Get sections for this version, ordered
  const { data: sections, error: sError } = await supabase
    .from('checklist_sections')
    .select('*')
    .eq('checklist_version_id', version.id)
    .order('display_order', { ascending: true });

  if (sError) {
    return {
      checklist,
      version: null,
      error: sError.message,
    };
  }

  // 4. Get all items for these sections, ordered
  const sectionIds = (sections as ChecklistSection[]).map((s) => s.id);
  const { data: items, error: iError } = await supabase
    .from('checklist_items')
    .select('*')
    .in('section_id', sectionIds)
    .order('display_order', { ascending: true });

  if (iError) {
    return {
      checklist,
      version: null,
      error: iError.message,
    };
  }

  // 5. Assemble the full version with nested sections → items
  const itemsBySection = new Map<string, ChecklistItem[]>();
  for (const item of items as ChecklistItem[]) {
    const existing = itemsBySection.get(item.section_id) ?? [];
    existing.push(item);
    itemsBySection.set(item.section_id, existing);
  }

  const fullVersion: FullChecklistVersion = {
    ...version,
    sections: (sections as ChecklistSection[]).map((section) => ({
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

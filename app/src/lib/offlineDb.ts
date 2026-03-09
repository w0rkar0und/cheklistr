import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Checklist, FullChecklistVersion, FieldType } from '../types/database';

// ============================================================
// Cheklistr: IndexedDB offline storage
// Stores pending submissions (with photo blobs), cached
// checklist data for fully offline form completion, and
// a single draft for resuming an in-progress inspection.
// ============================================================

/** A single photo stored as a compressed JPEG blob. */
export interface PendingPhoto {
  photoType: string;
  blob: Blob;
}

/** A defect with optional image blob. */
export interface PendingDefect {
  defectNumber: number;
  details: string;
  imageBlob: Blob | null;
}

/** A checklist response value. */
export interface PendingResponse {
  checklistItemId: string;
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueImageUrl: string | null;
}

/** Full submission payload stored in IndexedDB. */
export interface PendingSubmission {
  id?: number; // Auto-increment key
  submissionId: string;
  userId: string;
  checklistVersionId: string;
  vehicleRegistration: string;
  mileage: string;
  makeModel: string;
  colour: string;
  contractorId: string;
  contractorName: string;
  siteCode: string;
  responses: PendingResponse[];
  photos: PendingPhoto[];
  defects: PendingDefect[];
  latitude: number;
  longitude: number;
  tsFormStarted: string | null;
  tsFormReviewed: string | null;
  tsFormSubmitted: string;
  createdAt: string;
}

/** Cached checklist for offline form rendering. */
export interface CachedChecklist {
  checklist: Checklist;
  version: FullChecklistVersion;
  cachedAt: string;
}

// ── Draft types ──

/** A serialised checklist response for draft storage. */
export interface DraftResponse {
  itemId: string;
  fieldType: FieldType;
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueImageUrl: string | null;
}

/** A vehicle photo stored as a compressed blob in a draft. */
export interface DraftPhoto {
  photoType: string;
  blob: Blob;
}

/** A defect with optional image blob in a draft. */
export interface DraftDefect {
  id: string;
  details: string;
  imageBlob: Blob | null;
}

/** Complete draft form state stored in IndexedDB. */
export interface DraftFormState {
  userId: string;
  checklistVersionId: string;
  currentStep: 'vehicle-info' | 'photos' | 'checklist' | 'defects' | 'review';

  driverInfo: {
    hrCode: string;
    name: string;
    site: string;
  };
  vehicleInfo: {
    vehicleRegistration: string;
    mileage: string;
    makeModel: string;
    colour: string;
  };

  responses: DraftResponse[];
  vehiclePhotos: DraftPhoto[];
  defects: DraftDefect[];

  tsFormStarted: string | null;
  tsFormReviewed: string | null;
  savedAt: string;
}

interface CheklistrDB extends DBSchema {
  'pending-submissions': {
    key: number;
    value: PendingSubmission;
  };
  'checklist-cache': {
    key: string;
    value: CachedChecklist;
  };
  'drafts': {
    key: string;
    value: DraftFormState;
  };
}

const DB_NAME = 'cheklistr-offline';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<CheklistrDB>> | null = null;

function getDb(): Promise<IDBPDatabase<CheklistrDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CheklistrDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending-submissions')) {
          db.createObjectStore('pending-submissions', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains('checklist-cache')) {
          db.createObjectStore('checklist-cache');
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts');
        }
      },
    });
  }
  return dbPromise;
}

// ── Pending submissions ──

export async function savePendingSubmission(data: Omit<PendingSubmission, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add('pending-submissions', data as PendingSubmission);
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await getDb();
  return db.getAll('pending-submissions');
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.count('pending-submissions');
}

export async function deletePendingSubmission(id: number): Promise<void> {
  const db = await getDb();
  return db.delete('pending-submissions', id);
}

// ── Checklist cache ──

export async function cacheChecklist(checklist: Checklist, version: FullChecklistVersion): Promise<void> {
  const db = await getDb();
  await db.put('checklist-cache', {
    checklist,
    version,
    cachedAt: new Date().toISOString(),
  }, 'active');
}

export async function getCachedChecklist(): Promise<CachedChecklist | undefined> {
  const db = await getDb();
  return db.get('checklist-cache', 'active');
}

// ── Drafts (single draft, key = 'current') ──

export async function saveDraft(data: Omit<DraftFormState, 'savedAt'>): Promise<void> {
  const db = await getDb();
  await db.put('drafts', { ...data, savedAt: new Date().toISOString() } as DraftFormState, 'current');
}

export async function getDraft(): Promise<DraftFormState | undefined> {
  const db = await getDb();
  return db.get('drafts', 'current');
}

export async function deleteDraft(): Promise<void> {
  const db = await getDb();
  await db.delete('drafts', 'current');
}

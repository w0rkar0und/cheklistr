import { create } from 'zustand';
import type {
  Checklist,
  FullChecklistVersion,
  FieldType,
} from '../types/database';
import type { DraftFormState } from '../lib/offlineDb';

// ============================================================
// Response value for each checklist item
// ============================================================

export interface ResponseValue {
  itemId: string;
  fieldType: FieldType;
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueImageUrl: string | null;
}

// ============================================================
// Driver info (the van driver being inspected, NOT the logged-in user)
// ============================================================

export interface DriverInfo {
  hrCode: string;
  name: string;
  site: string;
}

// ============================================================
// Vehicle header info
// ============================================================

export interface VehicleInfo {
  vehicleRegistration: string;
  mileage: string;
  makeModel: string;
  colour: string;
}

// ============================================================
// Defect entry
// ============================================================

export interface DefectEntry {
  id: string;  // local UUID
  imageUrl: string | null;
  imageFile: File | null;
  details: string;
}

// ============================================================
// Store
// ============================================================

interface ChecklistFormState {
  // Loaded checklist data
  checklist: Checklist | null;
  version: FullChecklistVersion | null;

  // Form step tracking
  currentStep: 'vehicle-info' | 'photos' | 'checklist' | 'defects' | 'review';

  // Driver info (the van driver, not the logged-in user)
  driverInfo: DriverInfo;

  // Vehicle info
  vehicleInfo: VehicleInfo;

  // Responses keyed by checklist_item.id
  responses: Map<string, ResponseValue>;

  // Defects
  defects: DefectEntry[];

  // Vehicle photos (keyed by photo_type)
  vehiclePhotos: Map<string, { file: File | null; previewUrl: string | null }>;

  // Timestamps
  tsFormStarted: string | null;
  tsFormReviewed: string | null;

  // Loading state
  isLoading: boolean;
  loadError: string | null;

  // Actions
  setChecklistData: (checklist: Checklist, version: FullChecklistVersion) => void;
  setCurrentStep: (step: ChecklistFormState['currentStep']) => void;
  setDriverInfo: (info: Partial<DriverInfo>) => void;
  setVehicleInfo: (info: Partial<VehicleInfo>) => void;
  setResponse: (itemId: string, fieldType: FieldType, value: Partial<ResponseValue>) => void;
  addDefect: (defect: DefectEntry) => void;
  updateDefect: (id: string, updates: Partial<DefectEntry>) => void;
  removeDefect: (id: string) => void;
  setVehiclePhoto: (photoType: string, file: File | null, previewUrl: string | null) => void;
  setFormStarted: () => void;
  setFormReviewed: () => void;
  clearFormReviewed: () => void;
  setLoading: (loading: boolean) => void;
  setLoadError: (error: string | null) => void;
  resetForm: () => void;
  loadFromDraft: (draft: DraftFormState) => void;
}

const initialDriverInfo: DriverInfo = {
  hrCode: '',
  name: '',
  site: '',
};

const initialVehicleInfo: VehicleInfo = {
  vehicleRegistration: '',
  mileage: '',
  makeModel: '',
  colour: '',
};

export const useChecklistStore = create<ChecklistFormState>((set) => ({
  checklist: null,
  version: null,
  currentStep: 'vehicle-info',
  driverInfo: { ...initialDriverInfo },
  vehicleInfo: { ...initialVehicleInfo },
  responses: new Map(),
  defects: [],
  vehiclePhotos: new Map(),
  tsFormStarted: null,
  tsFormReviewed: null,
  isLoading: false,
  loadError: null,

  setChecklistData: (checklist, version) => {
    // Pre-populate responses with defaults for all items
    const responses = new Map<string, ResponseValue>();
    for (const section of version.sections) {
      for (const item of section.items) {
        responses.set(item.id, {
          itemId: item.id,
          fieldType: item.field_type,
          valueBoolean: item.field_type === 'boolean' ? null : null,
          valueText: null,
          valueNumber: null,
          valueImageUrl: null,
        });
      }
    }
    set({ checklist, version, responses });
  },

  setCurrentStep: (currentStep) => set({ currentStep }),

  setDriverInfo: (info) => set((state) => ({
    driverInfo: { ...state.driverInfo, ...info },
  })),

  setVehicleInfo: (info) => set((state) => ({
    vehicleInfo: { ...state.vehicleInfo, ...info },
  })),

  setResponse: (itemId, fieldType, value) => set((state) => {
    const responses = new Map(state.responses);
    const existing = responses.get(itemId) ?? {
      itemId,
      fieldType,
      valueBoolean: null,
      valueText: null,
      valueNumber: null,
      valueImageUrl: null,
    };
    responses.set(itemId, { ...existing, ...value });
    return { responses };
  }),

  addDefect: (defect) => set((state) => ({
    defects: [...state.defects, defect],
  })),

  updateDefect: (id, updates) => set((state) => ({
    defects: state.defects.map((d) =>
      d.id === id ? { ...d, ...updates } : d
    ),
  })),

  removeDefect: (id) => set((state) => ({
    defects: state.defects.filter((d) => d.id !== id),
  })),

  setVehiclePhoto: (photoType, file, previewUrl) => set((state) => {
    const vehiclePhotos = new Map(state.vehiclePhotos);
    vehiclePhotos.set(photoType, { file, previewUrl });
    return { vehiclePhotos };
  }),

  setFormStarted: () => set({ tsFormStarted: new Date().toISOString() }),

  setFormReviewed: () => set({ tsFormReviewed: new Date().toISOString() }),

  clearFormReviewed: () => set({ tsFormReviewed: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadError: (loadError) => set({ loadError }),

  resetForm: () => set({
    checklist: null,
    version: null,
    currentStep: 'vehicle-info',
    driverInfo: { ...initialDriverInfo },
    vehicleInfo: { ...initialVehicleInfo },
    responses: new Map(),
    defects: [],
    vehiclePhotos: new Map(),
    tsFormStarted: null,
    tsFormReviewed: null,
    isLoading: false,
    loadError: null,
  }),

  loadFromDraft: (draft) => {
    // Rebuild responses Map from serialised array
    const responses = new Map<string, ResponseValue>();
    for (const r of draft.responses) {
      responses.set(r.itemId, {
        itemId: r.itemId,
        fieldType: r.fieldType,
        valueBoolean: r.valueBoolean,
        valueText: r.valueText,
        valueNumber: r.valueNumber,
        valueImageUrl: r.valueImageUrl,
      });
    }

    // Rebuild vehiclePhotos Map from blobs → object URLs
    const vehiclePhotos = new Map<string, { file: File | null; previewUrl: string | null }>();
    for (const p of draft.vehiclePhotos) {
      const previewUrl = URL.createObjectURL(p.blob);
      vehiclePhotos.set(p.photoType, { file: null, previewUrl });
    }

    // Rebuild defects with blob → object URLs
    const defects: DefectEntry[] = draft.defects.map((d) => ({
      id: d.id,
      details: d.details,
      imageUrl: d.imageBlob ? URL.createObjectURL(d.imageBlob) : null,
      imageFile: null,
    }));

    set({
      currentStep: draft.currentStep,
      driverInfo: { ...draft.driverInfo },
      vehicleInfo: { ...draft.vehicleInfo },
      responses,
      vehiclePhotos,
      defects,
      tsFormStarted: draft.tsFormStarted,
      tsFormReviewed: draft.tsFormReviewed,
      isLoading: false,
      loadError: null,
    });
  },
}));

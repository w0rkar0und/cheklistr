import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import type {
  Checklist,
  ChecklistVersion,
  ChecklistSection,
  ChecklistItem,
  FieldType,
  ItemConfig,
  BooleanConfig,
  TextConfig,
  NumberConfig,
  SelectConfig,
  ImageConfig,
} from '../../types/database';

// ============================================================
// View Types
// ============================================================
type View = 'versions' | 'editor';

interface FullSection extends ChecklistSection {
  items: ChecklistItem[];
}

// ============================================================
// AdminChecklists — Main Component
// ============================================================
export function AdminChecklists() {
  const profile = useAuthStore((s) => s.profile);
  const [view, setView] = useState<View>('versions');
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [versions, setVersions] = useState<ChecklistVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editingVersion, setEditingVersion] = useState<ChecklistVersion | null>(null);
  const [sections, setSections] = useState<FullSection[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // ── Load checklist + versions ──
  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: checklists, error: clErr } = await supabase
      .from('checklists')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (clErr || !checklists?.length) {
      setError('No active checklist found');
      setLoading(false);
      return;
    }

    const cl = checklists[0] as Checklist;
    setChecklist(cl);

    const { data: vers, error: vErr } = await supabase
      .from('checklist_versions')
      .select('*')
      .eq('checklist_id', cl.id)
      .order('version_number', { ascending: false });

    if (vErr) {
      setError(vErr.message);
    } else {
      setVersions((vers ?? []) as ChecklistVersion[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // ── Load version for editing ──
  const loadVersionEditor = useCallback(async (version: ChecklistVersion, readOnly: boolean) => {
    setEditorLoading(true);
    setEditingVersion(version);
    setIsReadOnly(readOnly);
    setView('editor');

    const { data: secs, error: sErr } = await supabase
      .from('checklist_sections')
      .select('*')
      .eq('checklist_version_id', version.id)
      .order('display_order', { ascending: true });

    if (sErr) {
      setError(sErr.message);
      setEditorLoading(false);
      return;
    }

    const sectionIds = (secs as ChecklistSection[]).map((s) => s.id);
    let items: ChecklistItem[] = [];

    if (sectionIds.length > 0) {
      const { data: itemData, error: iErr } = await supabase
        .from('checklist_items')
        .select('*')
        .in('section_id', sectionIds)
        .order('display_order', { ascending: true });

      if (iErr) {
        setError(iErr.message);
        setEditorLoading(false);
        return;
      }
      items = (itemData ?? []) as ChecklistItem[];
    }

    // Assemble sections with items
    const itemsBySection = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const existing = itemsBySection.get(item.section_id) ?? [];
      existing.push(item);
      itemsBySection.set(item.section_id, existing);
    }

    const fullSections: FullSection[] = (secs as ChecklistSection[]).map((s) => ({
      ...s,
      items: itemsBySection.get(s.id) ?? [],
    }));

    setSections(fullSections);
    setEditorLoading(false);
  }, []);

  // ── Clone active version as draft ──
  const handleClone = async () => {
    if (!checklist || !profile) return;

    const activeVersion = versions.find((v) => v.is_active);
    if (!activeVersion) {
      setError('No active version to clone');
      return;
    }

    // Check if a draft already exists
    const hasDraft = versions.some((v) => !v.is_active && !v.published_at);
    if (hasDraft) {
      setError('A draft version already exists. Edit or publish it first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newVersionNumber = Math.max(...versions.map((v) => v.version_number)) + 1;

      // 1. Create new version
      const { data: newVer, error: vErr } = await supabase
        .from('checklist_versions')
        .insert({
          checklist_id: checklist.id,
          version_number: newVersionNumber,
          is_active: false,
        })
        .select()
        .single();

      if (vErr || !newVer) throw new Error(vErr?.message ?? 'Failed to create version');

      // 2. Fetch source sections
      const { data: srcSections } = await supabase
        .from('checklist_sections')
        .select('*')
        .eq('checklist_version_id', activeVersion.id)
        .order('display_order', { ascending: true });

      // 3. Clone sections + items
      for (const srcSection of (srcSections ?? []) as ChecklistSection[]) {
        const { data: newSection, error: sErr } = await supabase
          .from('checklist_sections')
          .insert({
            checklist_version_id: newVer.id,
            name: srcSection.name,
            display_order: srcSection.display_order,
          })
          .select()
          .single();

        if (sErr || !newSection) continue;

        const { data: srcItems } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('section_id', srcSection.id)
          .order('display_order', { ascending: true });

        if (srcItems && srcItems.length > 0) {
          const newItems = (srcItems as ChecklistItem[]).map((item) => ({
            section_id: newSection.id,
            label: item.label,
            field_type: item.field_type,
            display_order: item.display_order,
            is_required: item.is_required,
            config: item.config,
            triggers_defect: item.triggers_defect,
          }));

          await supabase.from('checklist_items').insert(newItems);
        }
      }

      await loadVersions();
      await loadVersionEditor(newVer as ChecklistVersion, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone failed');
      setLoading(false);
    }
  };

  // ── Publish a draft version ──
  const handlePublish = async (version: ChecklistVersion) => {
    if (!checklist || !profile) return;
    if (!window.confirm(`Publish Version ${version.version_number}? This will make it the active checklist for all users.`)) return;

    setLoading(true);
    setError(null);

    try {
      // Deactivate all versions
      const { error: deactErr } = await supabase
        .from('checklist_versions')
        .update({ is_active: false })
        .eq('checklist_id', checklist.id);

      if (deactErr) throw new Error(deactErr.message);

      // Activate the target version
      const { error: actErr } = await supabase
        .from('checklist_versions')
        .update({
          is_active: true,
          published_at: new Date().toISOString(),
          published_by: profile.id,
        })
        .eq('id', version.id);

      if (actErr) throw new Error(actErr.message);

      await loadVersions();
      setView('versions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
    setLoading(false);
  };

  // ── Delete a draft version ──
  const handleDeleteVersion = async (version: ChecklistVersion) => {
    if (version.is_active) return;
    if (!window.confirm(`Delete draft Version ${version.version_number}? This cannot be undone.`)) return;

    setLoading(true);
    try {
      // Manual cascade: items → sections → version
      // 1. Get section IDs for this version
      const { data: sections } = await supabase
        .from('checklist_sections')
        .select('id')
        .eq('checklist_version_id', version.id);

      if (sections && sections.length > 0) {
        const sectionIds = sections.map((s: { id: string }) => s.id);

        // 2. Delete all items in those sections
        const { error: itemsErr } = await supabase
          .from('checklist_items')
          .delete()
          .in('section_id', sectionIds);
        if (itemsErr) throw itemsErr;

        // 3. Delete all sections for this version
        const { error: sectionsErr } = await supabase
          .from('checklist_sections')
          .delete()
          .eq('checklist_version_id', version.id);
        if (sectionsErr) throw sectionsErr;
      }

      // 4. Delete the version itself
      const { error: versionErr } = await supabase
        .from('checklist_versions')
        .delete()
        .eq('id', version.id);
      if (versionErr) throw versionErr;

      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
    setLoading(false);
  };

  // ── Back to versions list ──
  const handleBackToVersions = () => {
    setView('versions');
    setEditingVersion(null);
    setSections([]);
    loadVersions();
  };

  // ==============================
  // Section Operations
  // ==============================

  const addSection = async () => {
    if (!editingVersion) return;
    const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.display_order)) : -1;

    const { data, error: err } = await supabase
      .from('checklist_sections')
      .insert({
        checklist_version_id: editingVersion.id,
        name: 'New Section',
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? 'Failed to add section');
      return;
    }

    setSections((prev) => [...prev, { ...(data as ChecklistSection), items: [] }]);
  };

  const updateSectionName = async (sectionId: string, name: string) => {
    const { error: err } = await supabase
      .from('checklist_sections')
      .update({ name })
      .eq('id', sectionId);

    if (!err) {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, name } : s))
      );
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!window.confirm('Delete this section and all its items?')) return;

    const { error: err } = await supabase
      .from('checklist_sections')
      .delete()
      .eq('id', sectionId);

    if (!err) {
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    }
  };

  const reorderSection = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sections.length) return;

    const a = sections[index];
    const b = sections[swapIndex];

    await Promise.all([
      supabase.from('checklist_sections').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('checklist_sections').update({ display_order: a.display_order }).eq('id', b.id),
    ]);

    setSections((prev) => {
      const next = [...prev];
      const tempOrder = next[index].display_order;
      next[index] = { ...next[index], display_order: next[swapIndex].display_order };
      next[swapIndex] = { ...next[swapIndex], display_order: tempOrder };
      next.sort((x, y) => x.display_order - y.display_order);
      return next;
    });
  };

  // ==============================
  // Item Operations
  // ==============================

  const addItem = async (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const maxOrder = section.items.length > 0
      ? Math.max(...section.items.map((i) => i.display_order))
      : -1;

    const { data, error: err } = await supabase
      .from('checklist_items')
      .insert({
        section_id: sectionId,
        label: 'New Item',
        field_type: 'boolean',
        display_order: maxOrder + 1,
        is_required: true,
        config: {},
        triggers_defect: false,
      })
      .select()
      .single();

    if (err || !data) {
      setError(err?.message ?? 'Failed to add item');
      return;
    }

    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, data as ChecklistItem] } : s
      )
    );
  };

  const updateItem = async (itemId: string, sectionId: string, updates: Partial<ChecklistItem>) => {
    const { error: err } = await supabase
      .from('checklist_items')
      .update(updates)
      .eq('id', itemId);

    if (!err) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
              }
            : s
        )
      );
    }
  };

  const deleteItem = async (itemId: string, sectionId: string) => {
    if (!window.confirm('Delete this item?')) return;

    const { error: err } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId);

    if (!err) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
            : s
        )
      );
    }
  };

  const reorderItem = async (sectionId: string, itemIndex: number, direction: 'up' | 'down') => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const swapIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (swapIndex < 0 || swapIndex >= section.items.length) return;

    const a = section.items[itemIndex];
    const b = section.items[swapIndex];

    await Promise.all([
      supabase.from('checklist_items').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('checklist_items').update({ display_order: a.display_order }).eq('id', b.id),
    ]);

    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const items = [...s.items];
        const tempOrder = items[itemIndex].display_order;
        items[itemIndex] = { ...items[itemIndex], display_order: items[swapIndex].display_order };
        items[swapIndex] = { ...items[swapIndex], display_order: tempOrder };
        items.sort((x, y) => x.display_order - y.display_order);
        return { ...s, items };
      })
    );
  };

  // ==============================
  // Render
  // ==============================

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (view === 'editor' && editingVersion) {
    return (
      <VersionEditor
        version={editingVersion}
        sections={sections}
        loading={editorLoading}
        readOnly={isReadOnly}
        error={error}
        onBack={handleBackToVersions}
        onPublish={() => handlePublish(editingVersion)}
        onAddSection={addSection}
        onUpdateSectionName={updateSectionName}
        onDeleteSection={deleteSection}
        onReorderSection={reorderSection}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
        onReorderItem={reorderItem}
      />
    );
  }

  // ── Versions List ──
  const activeVersion = versions.find((v) => v.is_active);
  const hasDraft = versions.some((v) => !v.is_active && !v.published_at);

  return (
    <div className="admin-checklists">
      <div className="admin-page-header">
        <h2>Checklist Management</h2>
        {checklist && <span className="admin-count">{checklist.name}</span>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="admin-toolbar">
        <button
          className="btn-primary"
          onClick={handleClone}
          disabled={hasDraft || !activeVersion}
        >
          {hasDraft ? 'Draft exists' : 'Create New Draft'}
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="empty-state">No versions found</p>
      ) : (
        <div className="version-list">
          {versions.map((ver) => {
            const isDraft = !ver.is_active && !ver.published_at;
            const isActive = ver.is_active;
            const status = isActive ? 'active' : isDraft ? 'draft' : 'previous';

            return (
              <div key={ver.id} className={`version-card version-card--${status}`}>
                <div className="version-card-header">
                  <span className="version-number">Version {ver.version_number}</span>
                  <span className={`version-badge version-badge--${status}`}>
                    {status === 'active' ? 'Active' : status === 'draft' ? 'Draft' : 'Previous'}
                  </span>
                </div>

                <div className="version-card-meta">
                  {ver.published_at
                    ? `Published ${new Date(ver.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : `Created ${new Date(ver.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </div>

                <div className="version-card-actions">
                  {isDraft ? (
                    <>
                      <button
                        className="btn-primary btn-small"
                        onClick={() => loadVersionEditor(ver, false)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-publish btn-small"
                        onClick={() => handlePublish(ver)}
                      >
                        Publish
                      </button>
                      <button
                        className="btn-danger btn-small"
                        onClick={() => handleDeleteVersion(ver)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => loadVersionEditor(ver, true)}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// VersionEditor — Section & Item Management
// ============================================================
interface VersionEditorProps {
  version: ChecklistVersion;
  sections: FullSection[];
  loading: boolean;
  readOnly: boolean;
  error: string | null;
  onBack: () => void;
  onPublish: () => void;
  onAddSection: () => void;
  onUpdateSectionName: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onReorderSection: (index: number, direction: 'up' | 'down') => void;
  onAddItem: (sectionId: string) => void;
  onUpdateItem: (itemId: string, sectionId: string, updates: Partial<ChecklistItem>) => void;
  onDeleteItem: (itemId: string, sectionId: string) => void;
  onReorderItem: (sectionId: string, itemIndex: number, direction: 'up' | 'down') => void;
}

function VersionEditor({
  version,
  sections,
  loading,
  readOnly,
  error,
  onBack,
  onPublish,
  onAddSection,
  onUpdateSectionName,
  onDeleteSection,
  onReorderSection,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItem,
}: VersionEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: 'auto', padding: '2rem 0' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="admin-checklists">
      <div className="editor-top-bar">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <div className="editor-title">
          <h2>Version {version.version_number}</h2>
          <span className={`version-badge version-badge--${readOnly ? (version.is_active ? 'active' : 'previous') : 'draft'}`}>
            {readOnly ? (version.is_active ? 'Active' : 'Previous') : 'Draft'}
          </span>
        </div>
        {!readOnly && (
          <button className="btn-publish" onClick={onPublish}>Publish</button>
        )}
      </div>

      <div className="editor-stats">
        <span>{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
        <span>&middot;</span>
        <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="sections-list">
        {sections.map((section, sIdx) => (
          <div key={section.id} className="section-editor">
            <div className="section-header">
              <div className="section-header-left">
                <button
                  className="section-expand-btn"
                  onClick={() => toggleExpand(section.id)}
                  aria-label={expandedSections.has(section.id) ? 'Collapse' : 'Expand'}
                >
                  {expandedSections.has(section.id) ? '▼' : '▶'}
                </button>

                {readOnly ? (
                  <span className="section-name-display">{section.name}</span>
                ) : (
                  <input
                    type="text"
                    className="section-name-input"
                    value={section.name}
                    onChange={(e) => onUpdateSectionName(section.id, e.target.value)}
                    onBlur={(e) => onUpdateSectionName(section.id, e.target.value)}
                  />
                )}

                <span className="section-item-count">{section.items.length} items</span>
              </div>

              {!readOnly && (
                <div className="section-header-actions">
                  <button
                    className="reorder-btn"
                    onClick={() => onReorderSection(sIdx, 'up')}
                    disabled={sIdx === 0}
                    aria-label="Move section up"
                  >
                    ↑
                  </button>
                  <button
                    className="reorder-btn"
                    onClick={() => onReorderSection(sIdx, 'down')}
                    disabled={sIdx === sections.length - 1}
                    aria-label="Move section down"
                  >
                    ↓
                  </button>
                  <button
                    className="btn-danger btn-small"
                    onClick={() => onDeleteSection(section.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {expandedSections.has(section.id) && (
              <div className="section-items">
                {section.items.map((item, iIdx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    sectionId={section.id}
                    index={iIdx}
                    totalItems={section.items.length}
                    readOnly={readOnly}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                    onReorder={onReorderItem}
                  />
                ))}

                {!readOnly && (
                  <button
                    className="btn-add-item"
                    onClick={() => onAddItem(section.id)}
                  >
                    + Add Item
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button className="btn-secondary" onClick={onAddSection} style={{ width: '100%', marginTop: '1rem' }}>
          + Add Section
        </button>
      )}
    </div>
  );
}

// ============================================================
// ItemRow — Single Item with inline editing
// ============================================================
interface ItemRowProps {
  item: ChecklistItem;
  sectionId: string;
  index: number;
  totalItems: number;
  readOnly: boolean;
  onUpdate: (itemId: string, sectionId: string, updates: Partial<ChecklistItem>) => void;
  onDelete: (itemId: string, sectionId: string) => void;
  onReorder: (sectionId: string, index: number, direction: 'up' | 'down') => void;
}

function ItemRow({ item, sectionId, index, totalItems, readOnly, onUpdate, onDelete, onReorder }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [fieldType, setFieldType] = useState<FieldType>(item.field_type);
  const [isRequired, setIsRequired] = useState(item.is_required);
  const [triggersDefect, setTriggersDefect] = useState(item.triggers_defect);
  const [config, setConfig] = useState<ItemConfig>(item.config);

  const handleSave = () => {
    onUpdate(item.id, sectionId, {
      label,
      field_type: fieldType,
      is_required: isRequired,
      triggers_defect: triggersDefect,
      config,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setLabel(item.label);
    setFieldType(item.field_type);
    setIsRequired(item.is_required);
    setTriggersDefect(item.triggers_defect);
    setConfig(item.config);
    setEditing(false);
  };

  // Reset local state when item prop changes
  useEffect(() => {
    setLabel(item.label);
    setFieldType(item.field_type);
    setIsRequired(item.is_required);
    setTriggersDefect(item.triggers_defect);
    setConfig(item.config);
  }, [item]);

  if (editing && !readOnly) {
    return (
      <div className="item-editor-form">
        <div className="item-editor-row">
          <label className="item-editor-label">
            Label
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="item-editor-input"
            />
          </label>

          <label className="item-editor-label">
            Type
            <select
              value={fieldType}
              onChange={(e) => {
                setFieldType(e.target.value as FieldType);
                setConfig({});
              }}
              className="item-editor-select"
            >
              <option value="boolean">Boolean</option>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="image">Image</option>
              <option value="select">Select</option>
            </select>
          </label>
        </div>

        <div className="item-editor-row">
          <label className="item-editor-checkbox">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Required
          </label>

          <label className="item-editor-checkbox">
            <input
              type="checkbox"
              checked={triggersDefect}
              onChange={(e) => setTriggersDefect(e.target.checked)}
            />
            Triggers Defect
          </label>
        </div>

        <ConfigEditor fieldType={fieldType} config={config} onChange={setConfig} />

        <div className="item-editor-actions">
          <button className="btn-primary btn-small" onClick={handleSave}>Save</button>
          <button className="btn-secondary btn-small" onClick={handleCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="item-row">
      <div className="item-row-left">
        <span className="item-label">{item.label}</span>
        <span className={`field-type-badge field-type-badge--${item.field_type}`}>
          {item.field_type}
        </span>
        {item.is_required && <span className="item-badge item-badge--required">Required</span>}
        {item.triggers_defect && <span className="item-badge item-badge--defect">Defect</span>}
      </div>

      {!readOnly && (
        <div className="item-row-actions">
          <button className="reorder-btn" onClick={() => onReorder(sectionId, index, 'up')} disabled={index === 0}>↑</button>
          <button className="reorder-btn" onClick={() => onReorder(sectionId, index, 'down')} disabled={index === totalItems - 1}>↓</button>
          <button className="btn-secondary btn-small" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-danger btn-small" onClick={() => onDelete(item.id, sectionId)}>×</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ConfigEditor — Field-type-specific config inputs
// ============================================================
interface ConfigEditorProps {
  fieldType: FieldType;
  config: ItemConfig;
  onChange: (config: ItemConfig) => void;
}

function ConfigEditor({ fieldType, config, onChange }: ConfigEditorProps) {
  switch (fieldType) {
    case 'boolean': {
      const c = config as BooleanConfig;
      return (
        <div className="config-fields">
          <label className="item-editor-label">
            Fail Value
            <select
              value={c.fail_value === true ? 'true' : c.fail_value === false ? 'false' : 'none'}
              onChange={(e) => {
                const val = e.target.value;
                onChange({
                  ...c,
                  fail_value: val === 'true' ? true : val === 'false' ? false : undefined,
                });
              }}
              className="item-editor-select"
            >
              <option value="none">None</option>
              <option value="true">Yes (true = fail)</option>
              <option value="false">No (false = fail)</option>
            </select>
          </label>
        </div>
      );
    }

    case 'text': {
      const c = config as TextConfig;
      return (
        <div className="config-fields">
          <label className="item-editor-label">
            Placeholder
            <input
              type="text"
              value={c.placeholder ?? ''}
              onChange={(e) => onChange({ ...c, placeholder: e.target.value || undefined })}
              className="item-editor-input"
            />
          </label>
          <label className="item-editor-label">
            Max Length
            <input
              type="number"
              value={c.max_length ?? ''}
              onChange={(e) => onChange({ ...c, max_length: e.target.value ? parseInt(e.target.value) : undefined })}
              className="item-editor-input"
            />
          </label>
          <label className="item-editor-checkbox">
            <input
              type="checkbox"
              checked={c.multiline ?? false}
              onChange={(e) => onChange({ ...c, multiline: e.target.checked })}
            />
            Multiline
          </label>
        </div>
      );
    }

    case 'number': {
      const c = config as NumberConfig;
      return (
        <div className="config-fields">
          <label className="item-editor-label">
            Min
            <input type="number" value={c.min ?? ''} onChange={(e) => onChange({ ...c, min: e.target.value ? parseFloat(e.target.value) : undefined })} className="item-editor-input" />
          </label>
          <label className="item-editor-label">
            Max
            <input type="number" value={c.max ?? ''} onChange={(e) => onChange({ ...c, max: e.target.value ? parseFloat(e.target.value) : undefined })} className="item-editor-input" />
          </label>
          <label className="item-editor-label">
            Step
            <input type="number" value={c.step ?? ''} onChange={(e) => onChange({ ...c, step: e.target.value ? parseFloat(e.target.value) : undefined })} className="item-editor-input" />
          </label>
          <label className="item-editor-label">
            Unit
            <input type="text" value={c.unit ?? ''} onChange={(e) => onChange({ ...c, unit: e.target.value || undefined })} className="item-editor-input" />
          </label>
          <label className="item-editor-label">
            Placeholder
            <input type="text" value={c.placeholder ?? ''} onChange={(e) => onChange({ ...c, placeholder: e.target.value || undefined })} className="item-editor-input" />
          </label>
        </div>
      );
    }

    case 'select': {
      const c = config as SelectConfig;
      return (
        <div className="config-fields">
          <label className="item-editor-label">
            Options (comma-separated)
            <input
              type="text"
              value={(c.options ?? []).join(', ')}
              onChange={(e) =>
                onChange({
                  ...c,
                  options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              className="item-editor-input"
              placeholder="Option 1, Option 2, Option 3"
            />
          </label>
          <label className="item-editor-checkbox">
            <input
              type="checkbox"
              checked={c.allow_other ?? false}
              onChange={(e) => onChange({ ...c, allow_other: e.target.checked })}
            />
            Allow &quot;Other&quot; option
          </label>
        </div>
      );
    }

    case 'image': {
      const c = config as ImageConfig;
      return (
        <div className="config-fields">
          <label className="item-editor-label">
            Max Count
            <input type="number" value={c.max_count ?? ''} onChange={(e) => onChange({ ...c, max_count: e.target.value ? parseInt(e.target.value) : undefined })} className="item-editor-input" />
          </label>
          <label className="item-editor-label">
            Required Count
            <input type="number" value={c.required_count ?? ''} onChange={(e) => onChange({ ...c, required_count: e.target.value ? parseInt(e.target.value) : undefined })} className="item-editor-input" />
          </label>
          <label className="item-editor-label">
            Guidance
            <input type="text" value={c.guidance ?? ''} onChange={(e) => onChange({ ...c, guidance: e.target.value || undefined })} className="item-editor-input" />
          </label>
        </div>
      );
    }

    default:
      return null;
  }
}

-- ============================================================
-- Cheklistr: Seed Data
-- Default checklist v1 matching current My WorkForms system
-- ============================================================

-- Create the default Vehicle Inspection checklist
INSERT INTO public.checklists (id, name, description, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Vehicle Inspection',
  'Standard vehicle inspection checklist for Contract Logistics fleet vehicles. Matches the original My WorkForms POC Vehicle Checklist.',
  true
);

-- Create version 1
INSERT INTO public.checklist_versions (id, checklist_id, version_number, is_active, published_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  1,
  true,
  now()
);

-- Create sections
INSERT INTO public.checklist_sections (id, checklist_version_id, name, display_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Exterior Checks', 1),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Interior Checks', 2),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Tyres & Wheels', 3),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Mirrors & Visibility', 4),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Mechanical', 5);

-- Exterior Checks
INSERT INTO public.checklist_items (section_id, label, field_type, display_order, is_required, triggers_defect, config) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Are the windscreen and mirrors clean and free of cracks/chips?', 'boolean', 1, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000001', 'Are the headlights/indicators working?', 'boolean', 2, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000001', 'Is the van free of any significant body damage?', 'boolean', 3, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000001', 'Is the van free of any branding?', 'boolean', 4, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000001', 'Is the van free of any fluid leaks?', 'boolean', 5, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000001', 'Does the van have windows at sides/back?', 'boolean', 6, true, true, '{"fail_value": false}');

-- Interior Checks
INSERT INTO public.checklist_items (section_id, label, field_type, display_order, is_required, triggers_defect, config) VALUES
  ('c0000000-0000-0000-0000-000000000002', 'Is the cab clear with no obstructions?', 'boolean', 1, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000002', 'Does the van have a bulkhead?', 'boolean', 2, true, true, '{"fail_value": false}');

-- Tyres & Wheels
INSERT INTO public.checklist_items (section_id, label, field_type, display_order, is_required, triggers_defect, config) VALUES
  ('c0000000-0000-0000-0000-000000000003', 'Are the tyres in good condition with at least 1.6mm of tread?', 'boolean', 1, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000003', 'Does the van have a usable spare wheel?', 'boolean', 2, true, true, '{"fail_value": false}');

-- Mirrors & Visibility
INSERT INTO public.checklist_items (section_id, label, field_type, display_order, is_required, triggers_defect, config) VALUES
  ('c0000000-0000-0000-0000-000000000004', 'Are the wipers working?', 'boolean', 1, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000004', 'Right side mirror (condition)', 'boolean', 2, true, true, '{"fail_value": false}'),
  ('c0000000-0000-0000-0000-000000000004', 'Left side mirror (condition)', 'boolean', 3, true, true, '{"fail_value": false}');

-- Mechanical
INSERT INTO public.checklist_items (section_id, label, field_type, display_order, is_required, triggers_defect, config) VALUES
  ('c0000000-0000-0000-0000-000000000005', 'Engine oil (level acceptable)', 'boolean', 1, true, true, '{"fail_value": false}');

-- ============================================================
-- Make photo storage buckets public
--
-- The buckets were created as private (public: false), which means
-- the /storage/v1/object/public/ URL pattern returns 400.
-- For an internal fleet inspection app, public read access is fine.
-- Upload policies still restrict who can write.
-- ============================================================

UPDATE storage.buckets SET public = true WHERE id = 'vehicle-photos';
UPDATE storage.buckets SET public = true WHERE id = 'defect-photos';
UPDATE storage.buckets SET public = true WHERE id = 'checklist-photos';
-- selfie-captures stays private (contains faces)

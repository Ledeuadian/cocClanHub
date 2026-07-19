-- ═══════════════════════════════════════════════════════════════════
-- BASE LAYOUT IMAGES
-- ═══════════════════════════════════════════════════════════════════
-- 1. Add an image_url column to the bases table
-- 2. Create a public storage bucket for base screenshots
-- 3. RLS policies so authenticated users can upload to their own
--    folder and anyone can view
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Add image_url and tags columns ─────────────────────────────
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a tags array column (new multi-select categories)
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Back-fill existing rows: copy single `tag` value into the array
UPDATE bases
  SET tags = ARRAY[tag]
  WHERE (tags IS NULL OR tags = '{}')
    AND tag IS NOT NULL;

-- ── 2. Create the 'bases' storage bucket ──────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('bases', 'bases', true)
ON CONFLICT (id) DO NOTHING;

-- ── 3. RLS policies for the bases bucket ──────────────────────────

-- Anyone can view base images (bucket is public)
DROP POLICY IF EXISTS "bases_select_all" ON storage.objects;
CREATE POLICY "bases_select_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'bases');

-- Authenticated users can upload to their own folder (uid/filename.png)
DROP POLICY IF EXISTS "bases_insert_own" ON storage.objects;
CREATE POLICY "bases_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bases'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
DROP POLICY IF EXISTS "bases_update_own" ON storage.objects;
CREATE POLICY "bases_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bases'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'bases'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
DROP POLICY IF EXISTS "bases_delete_own" ON storage.objects;
CREATE POLICY "bases_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bases'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 4. Enable RLS on bases table and add policies ────────────────
ALTER TABLE bases ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can read bases
DROP POLICY IF EXISTS "bases_select_all" ON bases;
CREATE POLICY "bases_select_all" ON bases
  FOR SELECT USING (true);

-- Authenticated users can insert their own bases
DROP POLICY IF EXISTS "bases_insert_own" ON bases;
CREATE POLICY "bases_insert_own" ON bases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Users can update/delete their own bases
DROP POLICY IF EXISTS "bases_update_own" ON bases;
CREATE POLICY "bases_update_own" ON bases
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "bases_delete_own_or_admin" ON bases;
CREATE POLICY "bases_delete_own_or_admin" ON bases
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

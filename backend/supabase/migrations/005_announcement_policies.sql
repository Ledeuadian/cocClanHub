-- ═══════════════════════════════════════════════════════════════════
-- ANNOUNCEMENT POLICIES (update/delete for authors and admins)
-- ═══════════════════════════════════════════════════════════════════
-- The initial schema created `ann_select_all` and `ann_insert_auth`
-- but didn't allow authors or admins to update/delete their posts.
-- ═══════════════════════════════════════════════════════════════════

-- Authors can update their own announcements, admins can update any.
DROP POLICY IF EXISTS "ann_update_own_or_admin" ON announcements;
CREATE POLICY "ann_update_own_or_admin" ON announcements
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- Authors can delete their own announcements, admins can delete any.
DROP POLICY IF EXISTS "ann_delete_own_or_admin" ON announcements;
CREATE POLICY "ann_delete_own_or_admin" ON announcements
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

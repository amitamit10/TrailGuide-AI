-- Create trip_members table for real-time collaboration
CREATE TABLE IF NOT EXISTS trip_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
  invited_by uuid REFERENCES profiles(id),
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

-- Trip owner can see all members of their trips
CREATE POLICY "trip_members_select" ON trip_members
  FOR SELECT USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Only trip owner can insert (invite)
CREATE POLICY "trip_members_insert" ON trip_members
  FOR INSERT WITH CHECK (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

-- Owner can delete any member; member can remove themselves
CREATE POLICY "trip_members_delete" ON trip_members
  FOR DELETE USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

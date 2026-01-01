-- Outlook Folder Support Migration
-- Adds folder-based organization as an alternative to categories
-- This allows emails to show up in native iOS Mail app (which doesn't support Outlook categories)

-- =====================================================
-- 1. ADD ORGANIZATION MODE TO SETTINGS
-- =====================================================
ALTER TABLE public.email_draft_settings
ADD COLUMN IF NOT EXISTS outlook_organization_mode TEXT DEFAULT 'categories'
  CHECK (outlook_organization_mode IN ('categories', 'folders', 'both'));

-- =====================================================
-- 2. ADD FOLDER MAPPING TO CATEGORIES TABLE
-- =====================================================
ALTER TABLE public.outlook_user_categories
ADD COLUMN IF NOT EXISTS folder_id TEXT,
ADD COLUMN IF NOT EXISTS folder_name TEXT;

-- =====================================================
-- 3. CREATE OUTLOOK FOLDERS TABLE
-- Tracks Moccet folders created in user's Outlook account
-- =====================================================
CREATE TABLE IF NOT EXISTS public.outlook_user_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Folder identification
  folder_name TEXT NOT NULL,         -- Our internal name (e.g., 'to_respond')
  outlook_folder_id TEXT,            -- Outlook's folder ID
  display_name TEXT NOT NULL,        -- Display name in Outlook (e.g., 'To Respond')
  parent_folder_id TEXT,             -- Parent folder ID (for Moccet parent folder)

  -- Status
  is_synced BOOLEAN DEFAULT false,   -- Whether folder exists in Outlook
  sync_error TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_email, folder_name)
);

CREATE INDEX IF NOT EXISTS idx_outlook_user_folders_email ON public.outlook_user_folders(user_email);
CREATE INDEX IF NOT EXISTS idx_outlook_user_folders_synced ON public.outlook_user_folders(user_email, is_synced);

-- Enable RLS
ALTER TABLE public.outlook_user_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on outlook_user_folders" ON public.outlook_user_folders
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 4. ADD ORGANIZATION METHOD TO LABEL ASSIGNMENTS
-- =====================================================
ALTER TABLE public.email_label_assignments
ADD COLUMN IF NOT EXISTS organization_method TEXT DEFAULT 'category'
  CHECK (organization_method IN ('category', 'folder', 'both')),
ADD COLUMN IF NOT EXISTS applied_folder_id TEXT;

-- =====================================================
-- 5. TRIGGER FOR UPDATED_AT ON FOLDERS TABLE
-- =====================================================
CREATE OR REPLACE FUNCTION update_outlook_user_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_outlook_user_folders_updated ON public.outlook_user_folders;
CREATE TRIGGER trigger_outlook_user_folders_updated
  BEFORE UPDATE ON public.outlook_user_folders
  FOR EACH ROW EXECUTE FUNCTION update_outlook_user_folders_updated_at();

-- Fix missing unique constraint on user_conversations.thread_id
-- Required for upsert operations
-- Author: Claude Code
-- Date: 2024-12-19

-- Add unique constraint on thread_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_conversations_thread_id_key'
  ) THEN
    ALTER TABLE user_conversations ADD CONSTRAINT user_conversations_thread_id_key UNIQUE (thread_id);
  END IF;
END $$;

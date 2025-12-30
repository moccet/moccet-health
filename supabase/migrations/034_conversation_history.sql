-- Conversation History Migration
-- Stores chat history between users and Moccet Voice assistants
-- Supports conversation compaction for token efficiency

-- =====================================================
-- 1. CONVERSATION HISTORY TABLE
-- Stores individual messages in conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  thread_id TEXT,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  agent TEXT, -- 'moccet-orchestrator' | 'moccet-chef' | null

  -- Compaction tracking
  is_compacted BOOLEAN DEFAULT false,
  compacted_summary TEXT,
  compaction_group_id UUID, -- Links messages that were compacted together

  -- Metadata
  token_count INTEGER,
  context_used JSONB, -- Which data sources were used for this response

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_email ON public.conversation_history(user_email);
CREATE INDEX IF NOT EXISTS idx_conversation_history_thread_id ON public.conversation_history(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_thread ON public.conversation_history(user_email, thread_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON public.conversation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_history_not_compacted ON public.conversation_history(user_email, is_compacted) WHERE is_compacted = false;

-- Enable RLS
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on conversation_history" ON public.conversation_history
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. CONVERSATION SUMMARIES TABLE
-- Stores compacted summaries of older conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,

  -- Summary content
  summary TEXT NOT NULL,
  key_facts JSONB, -- Extracted facts: preferences, decisions, action items
  topics_discussed TEXT[], -- Array of topics covered

  -- Time range this summary covers
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  message_count INTEGER NOT NULL,

  -- Metadata
  token_count INTEGER,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_email ON public.conversation_summaries(user_email);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_date_range ON public.conversation_summaries(user_email, start_date, end_date);

-- Enable RLS
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on conversation_summaries" ON public.conversation_summaries
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. USER CONTEXT PREFERENCES TABLE
-- Stores user preferences for context selection
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_context_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,

  -- Preferred data sources (for smart context selection)
  preferred_sources TEXT[] DEFAULT ARRAY['insights', 'labs', 'profile'],
  disabled_sources TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Context limits (overrides subscription defaults if set)
  max_conversation_depth INTEGER,
  max_context_tokens INTEGER,

  -- Learned preferences (updated by AI)
  communication_style JSONB, -- e.g., {"verbosity": "concise", "tone": "friendly"}
  topic_interests JSONB, -- e.g., {"sleep": 0.8, "nutrition": 0.6, "fitness": 0.4}

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_context_preferences_email ON public.user_context_preferences(user_email);

-- Enable RLS
ALTER TABLE public.user_context_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on user_context_preferences" ON public.user_context_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 4. FUNCTIONS
-- =====================================================

-- Function to get recent conversation history with compaction
CREATE OR REPLACE FUNCTION get_conversation_history(
  p_user_email TEXT,
  p_thread_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_include_summaries BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  agent TEXT,
  is_summary BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Return recent non-compacted messages
  RETURN QUERY
  SELECT
    ch.id,
    ch.role,
    ch.content,
    ch.agent,
    false AS is_summary,
    ch.created_at
  FROM public.conversation_history ch
  WHERE ch.user_email = p_user_email
    AND (p_thread_id IS NULL OR ch.thread_id = p_thread_id)
    AND ch.is_compacted = false
  ORDER BY ch.created_at DESC
  LIMIT p_limit;

  -- If including summaries, also return relevant summaries
  IF p_include_summaries THEN
    RETURN QUERY
    SELECT
      cs.id,
      'summary'::TEXT AS role,
      cs.summary AS content,
      NULL::TEXT AS agent,
      true AS is_summary,
      cs.end_date AS created_at
    FROM public.conversation_summaries cs
    WHERE cs.user_email = p_user_email
    ORDER BY cs.end_date DESC
    LIMIT 5;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to count user's conversation tokens
CREATE OR REPLACE FUNCTION get_user_conversation_stats(p_user_email TEXT)
RETURNS TABLE (
  total_messages INTEGER,
  uncompacted_messages INTEGER,
  total_summaries INTEGER,
  estimated_tokens INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.conversation_history WHERE user_email = p_user_email),
    (SELECT COUNT(*)::INTEGER FROM public.conversation_history WHERE user_email = p_user_email AND is_compacted = false),
    (SELECT COUNT(*)::INTEGER FROM public.conversation_summaries WHERE user_email = p_user_email),
    (SELECT COALESCE(SUM(token_count), 0)::INTEGER FROM public.conversation_history WHERE user_email = p_user_email AND is_compacted = false);
END;
$$ LANGUAGE plpgsql;

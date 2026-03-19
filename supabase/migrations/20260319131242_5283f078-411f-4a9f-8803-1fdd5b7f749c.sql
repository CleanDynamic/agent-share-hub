
-- Drop old messages table
DROP TABLE IF EXISTS messages CASCADE;

-- Create dm_threads
CREATE TABLE dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  last_message_sender_id uuid REFERENCES profiles(id),
  unread_count_a integer DEFAULT 0,
  unread_count_b integer DEFAULT 0,
  is_pinned_a boolean DEFAULT false,
  is_pinned_b boolean DEFAULT false,
  is_muted_a boolean DEFAULT false,
  is_muted_b boolean DEFAULT false,
  is_deleted_a boolean DEFAULT false,
  is_deleted_b boolean DEFAULT false,
  request_status text DEFAULT 'accepted',
  UNIQUE(participant_a, participant_b),
  CHECK (participant_a < participant_b)
);

-- Create dm_messages
CREATE TABLE dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text',
  text_content text,
  image_url text,
  voice_url text,
  voice_duration_seconds integer,
  shared_content_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  reply_to_message_id uuid REFERENCES dm_messages(id) ON DELETE SET NULL,
  is_unsent boolean DEFAULT false,
  is_liked boolean DEFAULT false,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz
);

-- Create dm_reactions
CREATE TABLE dm_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  reacted_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Create dm_presence
CREATE TABLE dm_presence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  last_seen_at timestamptz DEFAULT now()
);

-- Trigger: Update dm_threads on new message
CREATE OR REPLACE FUNCTION public.update_thread_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE dm_threads SET
    last_message_at = NEW.sent_at,
    last_message_preview = CASE
      WHEN NEW.message_type = 'text' THEN LEFT(NEW.text_content, 60)
      WHEN NEW.message_type = 'image' THEN '📷 Photo'
      WHEN NEW.message_type = 'voice' THEN '🎤 Voice message'
      WHEN NEW.message_type = 'post_share' THEN '📎 Shared a post'
      WHEN NEW.message_type = 'like' THEN '❤️'
      ELSE 'Message'
    END,
    last_message_sender_id = NEW.sender_id,
    unread_count_a = CASE
      WHEN participant_a != NEW.sender_id
      THEN unread_count_a + 1
      ELSE unread_count_a
    END,
    unread_count_b = CASE
      WHEN participant_b != NEW.sender_id
      THEN unread_count_b + 1
      ELSE unread_count_b
    END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON dm_messages
FOR EACH ROW EXECUTE FUNCTION update_thread_on_message();

-- RLS
ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_presence ENABLE ROW LEVEL SECURITY;

-- dm_threads policies
CREATE POLICY "Users can see their own threads"
ON dm_threads FOR SELECT TO authenticated
USING (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE POLICY "Users can insert threads they are part of"
ON dm_threads FOR INSERT TO authenticated
WITH CHECK (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE POLICY "Users can update their own thread metadata"
ON dm_threads FOR UPDATE TO authenticated
USING (participant_a = auth.uid() OR participant_b = auth.uid());

-- dm_messages policies
CREATE POLICY "Users can see messages in their threads"
ON dm_messages FOR SELECT TO authenticated
USING (thread_id IN (
  SELECT id FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));

CREATE POLICY "Users can insert messages in their threads"
ON dm_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  thread_id IN (
    SELECT id FROM dm_threads
    WHERE participant_a = auth.uid() OR participant_b = auth.uid()
  )
);

CREATE POLICY "Senders can update their own messages"
ON dm_messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid());

-- dm_reactions policies
CREATE POLICY "Users can see reactions in their threads"
ON dm_reactions FOR SELECT TO authenticated
USING (message_id IN (
  SELECT dm.id FROM dm_messages dm
  JOIN dm_threads dt ON dm.thread_id = dt.id
  WHERE dt.participant_a = auth.uid() OR dt.participant_b = auth.uid()
));

CREATE POLICY "Users can manage their own reactions"
ON dm_reactions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- dm_presence policies
CREATE POLICY "Users can see presence of people they have threads with"
ON dm_presence FOR SELECT TO authenticated
USING (user_id IN (
  SELECT CASE WHEN participant_a = auth.uid() THEN participant_b ELSE participant_a END
  FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
) OR user_id = auth.uid());

CREATE POLICY "Users can manage their own presence"
ON dm_presence FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_threads;


-- Create function to insert "message_received" notifications for all thread
-- members other than the sender when a new dm_messages row is inserted.
CREATE OR REPLACE FUNCTION public.notify_thread_members_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_uuid uuid;
BEGIN
  -- Members table (groups + new direct threads with members rows)
  FOR recipient_uuid IN
    SELECT user_id FROM public.dm_thread_members
     WHERE thread_id = NEW.thread_id AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, notification_type, metadata)
    VALUES (
      recipient_uuid,
      NEW.sender_id,
      'message_received',
      jsonb_build_object(
        'thread_id', NEW.thread_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END LOOP;

  -- Legacy participant_a/b path (in case members rows are missing)
  FOR recipient_uuid IN
    SELECT u FROM (
      SELECT participant_a AS u FROM public.dm_threads WHERE id = NEW.thread_id
      UNION
      SELECT participant_b AS u FROM public.dm_threads WHERE id = NEW.thread_id
    ) s
    WHERE u IS NOT NULL
      AND u <> NEW.sender_id
      AND NOT EXISTS (
        SELECT 1 FROM public.dm_thread_members
         WHERE thread_id = NEW.thread_id AND user_id = s.u
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
         WHERE n.recipient_id = s.u
           AND n.notification_type = 'message_received'
           AND (n.metadata->>'message_id')::uuid = NEW.id
      )
  LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, notification_type, metadata)
    VALUES (
      recipient_uuid,
      NEW.sender_id,
      'message_received',
      jsonb_build_object(
        'thread_id', NEW.thread_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dm_messages_notify_members ON public.dm_messages;
CREATE TRIGGER dm_messages_notify_members
AFTER INSERT ON public.dm_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_thread_members_on_message();

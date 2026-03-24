-- REBLOG SEED DATA
-- Creates one sample reblog so the feed shows a reblog card immediately.
-- Safe: only runs if the required profiles and original post exist.

DO $$
DECLARE
  v_alex_id    uuid;
  v_marcus_id  uuid;
  v_original_id uuid;
  v_reblog_id  uuid;
BEGIN
  -- Look up profile IDs
  SELECT id INTO v_alex_id   FROM profiles WHERE username = 'alex_prompt'  LIMIT 1;
  SELECT id INTO v_marcus_id FROM profiles WHERE username = 'marcus_ai'    LIMIT 1;

  -- Look up "The Email Rewriter" by alex
  IF v_alex_id IS NOT NULL THEN
    SELECT id INTO v_original_id
    FROM content_items
    WHERE creator_id = v_alex_id
      AND title ILIKE '%Email Rewriter%'
      AND status = 'approved'
    LIMIT 1;
  END IF;

  -- Only insert if we have all required data
  IF v_marcus_id IS NOT NULL AND v_original_id IS NOT NULL THEN

    -- Skip if marcus already has a reblog of this post
    IF NOT EXISTS (
      SELECT 1 FROM content_items
      WHERE creator_id = v_marcus_id
        AND is_reblog = true
        AND reblog_of_id = v_original_id
    ) THEN

      -- Insert the reblog content_item
      INSERT INTO content_items (
        creator_id,
        is_reblog,
        reblog_of_id,
        post_category,
        content_type,
        title,
        difficulty,
        status,
        approved_at,
        ai_tools,
        monetisation_type,
        is_free,
        view_count,
        download_count,
        reblog_thread_count
      ) VALUES (
        v_marcus_id,
        true,
        v_original_id,
        'blueprint',
        'Prompt File',
        'This is how I actually use The Email Rewriter',
        'Beginner',
        'approved',
        now() - interval '2 hours',
        ARRAY['ChatGPT', 'Claude'],
        'free',
        true,
        0,
        0,
        2  -- 3 blocks total, 2 beyond first
      )
      RETURNING id INTO v_reblog_id;

      -- Insert Block 1 (always shown in feed)
      INSERT INTO content_blocks (
        content_id, position, block_type, text_content, formatting_type
      ) VALUES (
        v_reblog_id, 1, 'text',
        'Alex''s Email Rewriter is solid but most people miss the key trick — you need to paste your original email FIRST before the prompt, not after. Here''s my exact setup:',
        'paragraph'
      );

      -- Insert Block 2 (thread)
      INSERT INTO content_blocks (
        content_id, position, block_type, text_content, formatting_type
      ) VALUES (
        v_reblog_id, 2, 'text',
        '1. Open a new ChatGPT conversation
2. Paste your draft email as the first message
3. Then paste the full prompt on the next line
4. Hit send — do not split into two messages',
        'numbers'
      );

      -- Insert Block 3 (thread)
      INSERT INTO content_blocks (
        content_id, position, block_type, text_content, formatting_type
      ) VALUES (
        v_reblog_id, 3, 'text',
        'The reason this works better is that the model reads the email in context before seeing the instruction. Tested on 47 emails last month. 100% pass rate.',
        'paragraph'
      );

    END IF;
  END IF;
END;
$$;

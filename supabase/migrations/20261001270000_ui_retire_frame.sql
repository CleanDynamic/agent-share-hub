-- UI-P41: Delete the site_frame feature flag row. The flag is no longer needed
-- since all routes now render in the site frame unconditionally.

delete from feature_flags where key = 'site_frame';

# UX-15 audit files

- `part0.md`: what exists, the reach-point table, the plan.
- `stub-schema.sql`: a scratch stand-in for the tables UX-15 touches (roles, `auth.uid()`, ten social tables, the live function bodies). Used only to run the migration and the plan; never applied to a real project.
- `rls-plan.sql`: A blocks B, then B cannot follow, message, reply to, like, react to, mention or comment on A, or start a topic from A's build; B cannot read the block row; the notification rules; deleting an account. Ends in `ROLLBACK`.

## Rebuild the scratch run (Postgres 16, any empty database)

```
python3 - <<'PY'            # pull the four live function bodies out of the migrations they were last defined in
import pathlib
M = pathlib.Path("supabase/migrations")
def grab(f, s, e="\n$$;"):
    t = (M/f).read_text(); i = t.index(s); return t[i:t.index(e, i)+len(e)]
parts = [grab("20261107170000_ux04_feed.sql", "CREATE FUNCTION public.get_build_feed("),
         grab("20261109120000_ux10_profile_feed.sql", "CREATE OR REPLACE FUNCTION public.profile_reader_view("),
         grab("20261001140000_rc_search_builds.sql", "CREATE OR REPLACE FUNCTION public.search_build_ids("),
         grab("20261108160000_ux09_site_hide_topics.sql", "CREATE OR REPLACE FUNCTION public.posts_guard_update()")]
pathlib.Path("/tmp/live_functions.sql").write_text("\n\n".join(parts)+"\n")
PY
psql -v ON_ERROR_STOP=1 -d scratch -f design/audits/ux-15/stub-schema.sql
(echo "set check_function_bodies = off;"; cat supabase/migrations/20261111120000_ux15_settings_blocking.sql) | psql -v ON_ERROR_STOP=1 -d scratch
psql -v ON_ERROR_STOP=1 -d scratch -f design/audits/ux-15/rls-plan.sql     # prints "UX-15 RLS plan: all checks passed"
```

Run on 7 November 2026 against Postgres 16.15: the plan passed, and applying the migration a second time changed nothing and the plan passed again.

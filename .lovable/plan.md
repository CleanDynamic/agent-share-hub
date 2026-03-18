

## Plan: Set your account as admin

**Problem**: Your profile has `is_admin: false`, so you can't access `/admin` to use the seed button or manage content.

**Solution**: Run a single database migration to set `is_admin = true` and `is_creator = true` on your profile (`a1d32f43-b788-4505-9251-17d94037cfb0`).

### Migration SQL
```sql
UPDATE profiles 
SET is_admin = true, is_creator = true 
WHERE id = 'a1d32f43-b788-4505-9251-17d94037cfb0';
```

That's the only change needed. The seed data is already live — refresh the preview to see content on Browse, Trending, and creator profiles.


// TODO: dynamic sitemap generation
// This script should query Supabase for all approved content_items and creator profiles,
// then generate a full sitemap.xml including:
// - /content/:id for each approved content item
// - /creator/:username for each creator profile
//
// Usage: node scripts/generate-sitemap.js
//
// Requirements:
// - SUPABASE_URL and SUPABASE_ANON_KEY environment variables
// - Write output to public/sitemap.xml
//
// Example:
// const { createClient } = require('@supabase/supabase-js');
// const fs = require('fs');
//
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
//
// async function generate() {
//   const { data: content } = await supabase
//     .from('content_items')
//     .select('id')
//     .eq('status', 'approved');
//
//   const { data: creators } = await supabase
//     .from('profiles')
//     .select('username')
//     .eq('is_creator', true);
//
//   // Build XML and write to public/sitemap.xml
// }
//
// generate();

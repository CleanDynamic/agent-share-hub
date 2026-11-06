-- UX-11 follow-up, step 2: clear the inherited "Unsolved" / bounty marks from published builds and rebuilds.
--
-- *** NOT IN supabase/migrations ON PURPOSE. DO NOT APPLY YET. ***
-- A "still open" mark made through UX-08 is stored the same way as an old Unsolved mark (build_nodes.is_gap, and the problem in
-- payload.gap_problem). The code that draws a mark (the tile's "Still open" line, Where it broke's Still open list, the Home section)
-- is UX-08's and UX-09's and stays; so this file may only clear a mark that nothing in the new system stands behind.
--
-- WHAT IS CLEARED: a node of a PUBLISHED build (builds.status in published, gallery) that is marked is_gap, and
--   * has no topic about it (no openbuild_posts row with about_node_id = the node's id), and
--   * so is not a mark UX-08 turned into a topic at publish.
-- It sets is_gap = false and removes payload.gap_problem. Nodes of drafts are not touched (a maker may be marking them now). A node
-- of the 'gap' type is left a node (its content stays); only the mark goes. The rows it changes are already copied to
-- legacy_backup_20261110.build_nodes_open_marks by the backup migration (restore: see its header).
--
-- DRY RUN, before applying: the same WHERE as a select count(*) (and a group by builds.status, parent_build_id is not null).
--   select count(*) from public.build_nodes n join public.builds b on b.id = n.build_id
--    where n.is_gap and b.status in ('published', 'gallery')
--      and not exists (select 1 from public.openbuild_posts p where p.about_node_id = n.id);
-- EXPLAIN (ANALYZE, BUFFERS) on that select: it should use build_nodes' is_gap/build_id index or a seq scan on build_nodes once, and an
-- index (or hash) on openbuild_posts.about_node_id. If openbuild_posts has no index on about_node_id, say so before applying.
--
-- LOVABLE MESSAGE (after copying this file to supabase/migrations under a newer timestamp):
--   Apply supabase/migrations/<the copied file> exactly as written. Change nothing else.
--   Then run the dry-run select (it should now return 0) and its EXPLAIN, and paste both back.

update public.build_nodes n
   set is_gap = false,
       payload = coalesce(n.payload, '{}'::jsonb) - 'gap_problem'
  from public.builds b
 where b.id = n.build_id
   and b.status in ('published', 'gallery')
   and n.is_gap
   and not exists (select 1 from public.openbuild_posts p where p.about_node_id = n.id);

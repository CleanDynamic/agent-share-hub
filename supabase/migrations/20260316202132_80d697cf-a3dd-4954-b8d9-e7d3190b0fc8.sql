
-- Fix: downloads INSERT — require valid content_id
DROP POLICY "Anyone can log a download" ON public.downloads;
CREATE POLICY "Anyone can log a download"
  ON public.downloads FOR INSERT
  WITH CHECK (
    content_id IN (SELECT id FROM public.content_items WHERE status = 'approved')
  );

-- Fix: service_enquiries INSERT — require valid listing_id
DROP POLICY "Anyone can submit an enquiry" ON public.service_enquiries;
CREATE POLICY "Anyone can submit an enquiry"
  ON public.service_enquiries FOR INSERT
  WITH CHECK (
    listing_id IN (SELECT id FROM public.service_listings WHERE is_active = true)
  );

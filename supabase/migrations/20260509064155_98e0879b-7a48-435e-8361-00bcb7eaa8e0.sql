UPDATE storage.buckets SET public = true WHERE id = 'person-photos';

DROP POLICY IF EXISTS "Authenticated users can view person photos" ON storage.objects;

CREATE POLICY "Public can view person photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'person-photos');
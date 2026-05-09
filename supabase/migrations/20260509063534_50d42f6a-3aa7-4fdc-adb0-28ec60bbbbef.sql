-- Make person-photos bucket private with size + MIME limits
UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'person-photos';

-- Drop permissive public read policy
DROP POLICY IF EXISTS "Public can view person photos" ON storage.objects;

-- Authenticated-only read policy for person-photos
CREATE POLICY "Authenticated users can view person photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'person-photos');
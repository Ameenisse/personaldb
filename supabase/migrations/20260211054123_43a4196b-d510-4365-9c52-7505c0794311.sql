
-- Create persons table
CREATE TABLE public.persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dob DATE NULL,
  sex TEXT NULL,
  contact TEXT NULL,
  building TEXT NULL,
  atoll TEXT NULL,
  island TEXT NULL,
  address_full TEXT NULL,
  photo_path TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- RLS policies: only authenticated users
CREATE POLICY "Authenticated users can select persons"
  ON public.persons FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert persons"
  ON public.persons FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update persons"
  ON public.persons FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete persons"
  ON public.persons FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create person-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('person-photos', 'person-photos', true);

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'person-photos' AND auth.role() = 'authenticated');

-- Storage RLS: authenticated users can update photos
CREATE POLICY "Authenticated users can update photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'person-photos' AND auth.role() = 'authenticated');

-- Storage RLS: authenticated users can delete photos
CREATE POLICY "Authenticated users can delete photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'person-photos' AND auth.role() = 'authenticated');

-- Storage RLS: public read for person-photos
CREATE POLICY "Public can view person photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'person-photos');

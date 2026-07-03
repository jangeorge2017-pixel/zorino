-- Remove SVG from public catalog image bucket (XSS risk when served from app origin)

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'catalog-images';

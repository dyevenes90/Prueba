-- Bucket privado para anexos de oportunidades y documentos de respaldo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'compra-agil-documentos' AND public IS TRUE
  ) THEN
    RAISE EXCEPTION 'El bucket compra-agil-documentos ya existe y es público';
  END IF;

  INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    (
      'compra-agil-documentos',
      'compra-agil-documentos',
      false,
      26214400,
      ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'image/jpeg',
        'image/png'
      ]
    )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

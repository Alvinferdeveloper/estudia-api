-- Extensión vector para embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de chunks vectorizados
CREATE TABLE document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     TEXT NOT NULL,
  page_number     INTEGER NOT NULL,
  chunk_index    INTEGER NOT NULL,
  content        TEXT NOT NULL,
  embedding      vector(3072),
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Índice para búsqueda por documento
CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);

-- Función de búsqueda por similitud coseno
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(3072),
  match_document_id TEXT,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  page_number INT,
  chunk_index INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.page_number,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.document_id = match_document_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

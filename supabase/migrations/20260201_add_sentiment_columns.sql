alter table public.journal_entries
add column if not exists sentiment_label text,
add column if not exists sentiment_score double precision,
add column if not exists sentiment_summary text,
add column if not exists sentiment_json jsonb,
add column if not exists sentiment_updated_at timestamptz;


-- Aggregate first-party usage; visitor identity is a keyed hash of a random browser id.
CREATE TABLE usage_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'search', 'favorite_add', 'favorite_remove', 'export')),
  visitor_hash text NOT NULL,
  path text,
  search_term text
);
CREATE INDEX usage_events_time_idx ON usage_events (occurred_at DESC);
CREATE INDEX usage_events_visitor_time_idx ON usage_events (visitor_hash, occurred_at DESC);

-- ==============================================================================
-- ATHENA — PHASE 22A: POSTGRESQL PERSISTENCE SCHEMA
-- Frozen Phase 21D.1 Database DDL
-- ==============================================================================

-- 1. PORTFOLIOS DOMAIN
CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    base_currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    cash_inr NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_positions (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    underlying_symbol TEXT NOT NULL,
    asset_class TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    entry_price NUMERIC(14, 4) NOT NULL,
    current_price NUMERIC(14, 4) NOT NULL,
    strike_price NUMERIC(14, 4),
    expiry_date DATE,
    greeks JSONB,
    normalized_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_timeline (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL
);

-- 2. CANONICAL NEWS & INTELLIGENCE DOMAIN
CREATE TABLE IF NOT EXISTS news_articles (
    id TEXT PRIMARY KEY,
    canonical_url TEXT UNIQUE NOT NULL,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    source JSONB NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL,
    category TEXT NOT NULL,
    primary_category TEXT NOT NULL,
    secondary_categories TEXT[] NOT NULL DEFAULT '{}',
    sentiment TEXT NOT NULL,
    relevance_score NUMERIC(6, 2) NOT NULL,
    event_type TEXT NOT NULL,
    category_confidence TEXT NOT NULL,
    classification_evidence JSONB NOT NULL DEFAULT '[]',
    fno JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS news_intelligence (
    article_id TEXT NOT NULL,
    intelligence_version TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    headline TEXT NOT NULL,
    source TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    company_name TEXT,
    symbol TEXT,
    entity_type TEXT,
    fno_eligible BOOLEAN NOT NULL DEFAULT false,
    materiality_score NUMERIC(6, 2) NOT NULL,
    executive_summary TEXT,
    financial_metrics JSONB NOT NULL DEFAULT '[]',
    key_facts JSONB NOT NULL DEFAULT '[]',
    evidence_spans JSONB NOT NULL DEFAULT '[]',
    metrics_json JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (article_id, intelligence_version)
);

-- 3. QUANT SIGNALS, LEDGER & RESEARCH OUTCOMES
CREATE TABLE IF NOT EXISTS signals (
    signal_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    current_state TEXT NOT NULL,
    timeline JSONB NOT NULL DEFAULT '[]',
    raw_score NUMERIC(8, 2) NOT NULL,
    decayed_score NUMERIC(8, 2) NOT NULL,
    decay_factor NUMERIC(6, 4) NOT NULL,
    actionability TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS signal_ledger (
    id BIGSERIAL PRIMARY KEY,
    signal_id TEXT NOT NULL UNIQUE,
    event_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    initial_score NUMERIC(8, 2) NOT NULL,
    peak_score NUMERIC(8, 2) NOT NULL,
    initial_priority TEXT NOT NULL,
    final_state TEXT NOT NULL,
    initial_alignment TEXT NOT NULL,
    final_alignment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    invalidated_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    duration INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS signal_outcomes (
    signal_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    mfe_percent DOUBLE PRECISION NOT NULL,
    mae_percent DOUBLE PRECISION NOT NULL,
    peak_price NUMERIC(18, 4) NOT NULL,
    last_observed_price NUMERIC(18, 4) NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    time_buckets JSONB NOT NULL DEFAULT '{}',
    timeline JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL
);

-- 4. TELEGRAM QUEUE DOMAIN
CREATE TABLE IF NOT EXISTS telegram_outbox (
    id BIGSERIAL PRIMARY KEY,
    article_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INDEXES (Derived from actual query patterns; no speculative or duplicate indexes)
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_intelligence_symbol ON news_intelligence (symbol, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_active ON signals (current_state) WHERE current_state = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_signal_outcomes_resolved ON signal_outcomes (is_resolved);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_portfolio ON portfolio_positions (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_telegram_outbox_created_at ON telegram_outbox (created_at ASC);

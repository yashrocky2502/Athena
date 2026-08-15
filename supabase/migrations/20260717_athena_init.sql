-- ATHENA KNOWLEDGE VAULT SCHEMA
-- Production Migration for Supabase (PostgreSQL)

-- Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    current_name TEXT,
    sector TEXT,
    industry TEXT,
    exchange TEXT,
    isin TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Corporate Actions Table
CREATE TABLE IF NOT EXISTS corporate_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    action_type TEXT NOT NULL, -- Dividend, Bonus, Split, Demerger, Merger, Name Change, Rights Issue
    effective_date DATE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- News Events Table
CREATE TABLE IF NOT EXISTS news_events (
    event_id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    summary TEXT,
    company TEXT NOT NULL,
    category TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    source_name TEXT,
    source_url TEXT,
    priority TEXT,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Intelligence Reports Table
CREATE TABLE IF NOT EXISTS intelligence_reports (
    event_id TEXT PRIMARY KEY,
    company TEXT NOT NULL, -- Symbol or ID
    headline TEXT,
    intelligence_json JSONB NOT NULL,
    confidence NUMERIC,
    evidence_count INTEGER DEFAULT 0,
    source_urls TEXT[],
    generated_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_intel_company ON intelligence_reports(company);
CREATE INDEX IF NOT EXISTS idx_news_company ON news_events(company);
CREATE INDEX IF NOT EXISTS idx_news_timestamp ON news_events(timestamp DESC);

-- Saved Research Table
CREATE TABLE IF NOT EXISTS saved_research (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id TEXT REFERENCES news_events(event_id) ON DELETE SET NULL,
    data JSONB,
    saved_at TIMESTAMPTZ DEFAULT now()
);

-- Telegram Notifications Table
CREATE TABLE IF NOT EXISTS telegram_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    company TEXT,
    category TEXT,
    priority TEXT,
    delivery_status TEXT, -- Queued, Delivered, Failed
    telegram_message_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT now()
);

-- Watchlists Table
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Nifty200 Events Table
CREATE TABLE IF NOT EXISTS nifty200_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    company TEXT,
    event_id TEXT,
    priority TEXT,
    telegram_sent BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ DEFAULT now()
);

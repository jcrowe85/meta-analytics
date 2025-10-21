-- Database initialization script for Meta Analytics
-- This script will be run when the PostgreSQL container starts for the first time

-- Create the database (if not exists)
-- Note: The database is already created by the POSTGRES_DB environment variable

-- Create tables for caching and analytics data
CREATE TABLE IF NOT EXISTS cache_entries (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for cache lookups
CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);

-- Create table for ad performance data
CREATE TABLE IF NOT EXISTS ad_performance (
    id SERIAL PRIMARY KEY,
    ad_id VARCHAR(255) NOT NULL,
    ad_name TEXT,
    status VARCHAR(50),
    effective_status VARCHAR(50),
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,
    cpm DECIMAL(10,2) DEFAULT 0,
    cpc DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,
    frequency DECIMAL(5,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    performance_score INTEGER DEFAULT 0,
    image_url TEXT,
    image_source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ad performance queries
CREATE INDEX IF NOT EXISTS idx_ad_id ON ad_performance(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_status ON ad_performance(status);
CREATE INDEX IF NOT EXISTS idx_ad_effective_status ON ad_performance(effective_status);
CREATE INDEX IF NOT EXISTS idx_ad_created_at ON ad_performance(created_at);

-- Create table for account insights
CREATE TABLE IF NOT EXISTS account_insights (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,
    cpm DECIMAL(10,2) DEFAULT 0,
    cpc DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,
    frequency DECIMAL(5,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    link_clicks INTEGER DEFAULT 0,
    link_ctr DECIMAL(5,4) DEFAULT 0,
    link_cpc DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Create index for account insights queries
CREATE INDEX IF NOT EXISTS idx_account_insights_date ON account_insights(date);

-- Create table for campaign insights
CREATE TABLE IF NOT EXISTS campaign_insights (
    id SERIAL PRIMARY KEY,
    campaign_id VARCHAR(255) NOT NULL,
    campaign_name TEXT,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,
    cpm DECIMAL(10,2) DEFAULT 0,
    cpc DECIMAL(10,2) DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,
    frequency DECIMAL(5,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, date)
);

-- Create indexes for campaign insights queries
CREATE INDEX IF NOT EXISTS idx_campaign_insights_campaign_id ON campaign_insights(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_insights_date ON campaign_insights(date);

-- Create table for application logs
CREATE TABLE IF NOT EXISTS app_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for log queries
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at);

-- Create a function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM cache_entries WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at columns
CREATE TRIGGER update_cache_entries_updated_at
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ad_performance_updated_at
    BEFORE UPDATE ON ad_performance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_insights_updated_at
    BEFORE UPDATE ON account_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_insights_updated_at
    BEFORE UPDATE ON campaign_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial data or configuration if needed
-- (Add any initial data here)

COMMENT ON TABLE cache_entries IS 'Stores cached API responses and computed data';
COMMENT ON TABLE ad_performance IS 'Stores ad performance metrics and metadata';
COMMENT ON TABLE account_insights IS 'Stores daily account-level performance insights';
COMMENT ON TABLE campaign_insights IS 'Stores daily campaign-level performance insights';
COMMENT ON TABLE app_logs IS 'Stores application logs for debugging and monitoring';


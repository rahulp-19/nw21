-- ====================================================
-- SweetXXorn - Supabase Database Schema Setup
-- Run these commands in the Supabase SQL Editor to provision your database tables.
-- ====================================================

-- 1. Users Table (Stores user profiles and subscription status)
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  "displayName" TEXT,
  role TEXT DEFAULT 'user',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  subscription JSONB DEFAULT '{"planId": null, "status": "none", "expiresAt": null, "gateway": null}'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to users" ON users 
  FOR SELECT USING (true);

CREATE POLICY "Allow users to update/insert their own profile" ON users 
  FOR ALL USING (auth.uid()::text = uid) WITH CHECK (auth.uid()::text = uid);

CREATE POLICY "Allow admin full access to users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );


-- 2. Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  "videoUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  category TEXT NOT NULL,
  "previewDuration" INT DEFAULT 10,
  "premiumOnly" BOOLEAN DEFAULT true,
  "uploadDate" TIMESTAMPTZ DEFAULT NOW(),
  tags JSONB DEFAULT '[]'::jsonb,
  views INT DEFAULT 0
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to videos" ON videos 
  FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to videos" ON videos 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );


-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to categories" ON categories 
  FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to categories" ON categories 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );


-- 4. Subscriptions / Plans Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  "durationDays" INT DEFAULT 30,
  enabled BOOLEAN DEFAULT true
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to subscriptions" ON subscriptions 
  FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to subscriptions" ON subscriptions 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );

-- Seed Default pricing packages
INSERT INTO subscriptions (id, name, price, currency, "durationDays", enabled) VALUES
('sub_weekly', 'Weekly Elite', 4.99, 'USD', 7, true),
('sub_monthly', 'Monthly Yellow VIP', 14.99, 'USD', 30, true),
('sub_yearly', 'Yearly Yellow VIP', 99.99, 'USD', 365, true),
('sub_weekly_inr', 'Weekly Elite (INR)', 399.00, 'INR', 7, true),
('sub_monthly_inr', 'Monthly Yellow (INR)', 1199.00, 'INR', 30, true),
('sub_yearly_inr', 'Yearly Yellow (INR)', 7999.00, 'INR', 365, true)
ON CONFLICT (id) DO NOTHING;


-- 5. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "transactionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  gateway TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "durationDays" INT NOT NULL,
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to read their own payments" ON payments 
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Allow users to insert their own payments" ON payments 
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Allow admin full access to payments" ON payments 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );


-- 6. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'payment_settings',
  "stripeKey" TEXT,
  "razorpayKey" TEXT,
  "paypalKey" TEXT,
  "defaultGateway" TEXT DEFAULT 'stripe',
  "taxPercentage" NUMERIC(5, 2) DEFAULT 18,
  "enabledGateways" JSONB DEFAULT '["stripe", "razorpay", "paypal", "upi", "card"]'::jsonb,
  "heroBgUrl" TEXT
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to settings" ON settings 
  FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to settings" ON settings 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );

-- Seed default settings
INSERT INTO settings (id, "stripeKey", "razorpayKey", "paypalKey", "defaultGateway", "taxPercentage", "enabledGateways", "heroBgUrl") VALUES
('payment_settings', 'pk_test_mock_sweetxxorn_51P', 'rzp_test_mock_sweetxxorn_3N', 'paypal_mock_client_id_sweetxxorn', 'stripe', 18, '["stripe", "razorpay", "paypal", "upi", "card"]'::jsonb, 'background.png')
ON CONFLICT (id) DO NOTHING;


-- 7. Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to announcements" ON announcements 
  FOR SELECT USING (true);

CREATE POLICY "Allow admin full access to announcements" ON announcements 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.uid = auth.uid()::text AND users.role = 'admin'
    )
  );

-- Seed default announcements
INSERT INTO announcements (title, content, pinned) VALUES
('✨ Welcome to SweetXXorn Premium Streaming!', 'Enjoy access to our highly curated collection of 4K cinematic premium streams. Upgrade to VIP to bypass all preview timers.', true),
('💳 New Payment Gateways Added', 'We now support UPI, Credit Card, Razorpay, and PayPal for seamless one-click billing worldwide.', false);

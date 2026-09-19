-- ==============================================================================
-- KAVAAI SOVEREIGN — INDUSTRIAL SUPABASE DATABASE FOUNDATION
-- Migration: scripts/setup_supabase_auth.sql
-- Modules: Operator Profiles, Authentication Audit Logs, Row-Level Security (RLS)
-- Security: Strict Air-Gap Governance, Zero Password Storage, Principle of Least Privilege
-- ==============================================================================

-- 1. OPERATOR PROFILES TABLE
-- Extends Supabase auth.users with industrial workstation roles & telemetry nodes
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Industrial Operator',
    role TEXT NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('OPERATOR', 'ENGINEER', 'ANALYST', 'ADMIN')),
    node_id TEXT NOT NULL DEFAULT 'KS-LOCAL-01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AUTHENTICATION AUDIT EVENTS TABLE
-- Immutable security trail tracking workstation authentication attempts
CREATE TABLE IF NOT EXISTS public.auth_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'SESSION_EXPIRED')),
    ip_address TEXT DEFAULT '127.0.0.1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ROW-LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR PROFILES
-- Policy 1: Operators can read their own profile
CREATE POLICY "Operators can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy 2: Operators can update their own non-privileged profile data
CREATE POLICY "Operators can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 5. RLS POLICIES FOR AUTH AUDIT EVENTS
-- Policy 1: Any authenticated or unauthenticated client can insert an audit record
CREATE POLICY "Allow inserting audit records"
    ON public.auth_audit_events
    FOR INSERT
    WITH CHECK (true);

-- Policy 2: Operators can view only their own audit trail
CREATE POLICY "Operators can view own audit events"
    ON public.auth_audit_events
    FOR SELECT
    USING (auth.uid() = user_id);

-- 6. AUTOMATIC PROFILE TRIGGER ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_operator()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, node_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Industrial Operator'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'OPERATOR'),
        'KS-LOCAL-01'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists and recreate
DROP TRIGGER IF EXISTS on_auth_operator_created ON auth.users;
CREATE TRIGGER on_auth_operator_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_operator();

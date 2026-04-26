-- MySQL 8 bootstrap (DB + schema) for this CRM.
--
-- 1) Edit the placeholders:
--    - crm_db_name
--    - crm_user / strong_password_here (optional, if you want a dedicated DB user)
--
-- 2) Run this whole file in your MySQL client.

-- =========================================
-- DATABASE (create + select)
-- =========================================
CREATE DATABASE IF NOT EXISTS crm_bitora
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE crm_bitora;

-- =========================================
-- (OPTIONAL) DB USER + GRANTS
-- If you don't have privilege to create users, skip this section.
-- =========================================
-- CREATE USER IF NOT EXISTS 'crm_user'@'%' IDENTIFIED BY 'strong_password_here';
-- GRANT ALL PRIVILEGES ON crm_bitora.* TO 'crm_user'@'%';
-- FLUSH PRIVILEGES;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  confirmed_at DATETIME(3) NULL,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,
  user_metadata JSON NULL,
  app_metadata JSON NULL,
  recovery_token VARCHAR(128) NULL,
  recovery_sent_at DATETIME(3) NULL,
  last_sign_in_at DATETIME(3) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  refresh_token VARCHAR(128) NULL,
  expires_at DATETIME(3) NOT NULL,
  user_agent TEXT NULL,
  ip_address VARCHAR(64) NULL,
  last_activity_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  event_type VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_auth_audit_user (user_id),
  INDEX idx_auth_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS licenses (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL,
  plan VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_licenses_user (user_id),
  CONSTRAINT fk_licenses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(320) NULL,
  tags JSON NULL,
  status VARCHAR(32) NULL,
  lead_source VARCHAR(64) NULL,
  contact_request TEXT NULL,
  first_contacted_at DATETIME(3) NULL,
  lat DOUBLE NULL,
  lon DOUBLE NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_clients_owner (owner_id),
  INDEX idx_clients_created (created_at),
  CONSTRAINT fk_clients_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL UNIQUE,
  brand_name VARCHAR(255) NULL,
  logo_url TEXT NULL,
  smtp_host VARCHAR(255) NULL,
  smtp_port INT NULL,
  smtp_secure BOOLEAN NULL,
  smtp_user VARCHAR(255) NULL,
  smtp_password_enc TEXT NULL,
  smtp_from_email VARCHAR(320) NULL,
  smtp_from_name VARCHAR(255) NULL,
  smtp_reply_to VARCHAR(320) NULL,
  api_key VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_settings_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_templates (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_html LONGTEXT NOT NULL,
  body_text LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_templates_owner (owner_id),
  CONSTRAINT fk_templates_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_sends (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  client_id CHAR(36) NULL,
  template_id CHAR(36) NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  sent_at DATETIME(3) NULL,
  error TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_sends_owner (owner_id),
  INDEX idx_sends_created (created_at),
  CONSTRAINT fk_sends_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);


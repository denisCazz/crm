-- =========================================
-- CRM Bitora – Document Management & Deadlines extension
-- Run this AFTER schema.sql (or add to it directly).
-- MySQL 8+
-- =========================================

USE crm_bitora;

-- =========================================
-- documents: metadati file collegati a clienti
-- =========================================
CREATE TABLE IF NOT EXISTS documents (
  id           CHAR(36)     PRIMARY KEY,
  owner_id     CHAR(36)     NOT NULL,
  client_id    CHAR(36)     NULL,
  title        VARCHAR(500) NOT NULL,
  description  TEXT         NULL,
  doc_type     VARCHAR(64)  NULL COMMENT 'contrato, fattura, preventivo, altro...',
  status       VARCHAR(32)  NOT NULL DEFAULT 'active' COMMENT 'active, archived, deleted',
  file_name    VARCHAR(500) NOT NULL,
  mime_type    VARCHAR(255) NULL,
  file_size    BIGINT       NULL COMMENT 'bytes',
  s3_key       VARCHAR(1000) NOT NULL COMMENT 'S3 object key',
  s3_bucket    VARCHAR(255) NULL,
  doc_date     DATE         NULL COMMENT 'data del documento (diversa da upload)',
  expires_at   DATETIME(3)  NULL COMMENT 'scadenza del documento (es. contratto)',
  tags         JSON         NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_docs_owner   (owner_id),
  INDEX idx_docs_client  (client_id),
  INDEX idx_docs_status  (status),
  INDEX idx_docs_created (created_at),
  CONSTRAINT fk_docs_owner  FOREIGN KEY (owner_id)  REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_docs_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- =========================================
-- document_versions: storico versioni di un documento
-- =========================================
CREATE TABLE IF NOT EXISTS document_versions (
  id           CHAR(36)      PRIMARY KEY,
  document_id  CHAR(36)      NOT NULL,
  version_num  INT           NOT NULL DEFAULT 1,
  file_name    VARCHAR(500)  NOT NULL,
  mime_type    VARCHAR(255)  NULL,
  file_size    BIGINT        NULL,
  s3_key       VARCHAR(1000) NOT NULL,
  uploaded_by  CHAR(36)      NULL COMMENT 'user_id that uploaded',
  note         TEXT          NULL,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_docver_document (document_id),
  CONSTRAINT fk_docver_doc  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_docver_user FOREIGN KEY (uploaded_by) REFERENCES users(id)     ON DELETE SET NULL
);

-- =========================================
-- document_events: audit log / timeline attività
-- =========================================
CREATE TABLE IF NOT EXISTS document_events (
  id          CHAR(36)     PRIMARY KEY,
  document_id CHAR(36)     NOT NULL,
  owner_id    CHAR(36)     NOT NULL,
  event_type  VARCHAR(64)  NOT NULL COMMENT 'uploaded, viewed, downloaded, shared, updated, deleted',
  actor_id    CHAR(36)     NULL COMMENT 'user_id that triggered the event',
  metadata    JSON         NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_devt_document (document_id),
  INDEX idx_devt_owner    (owner_id),
  INDEX idx_devt_created  (created_at),
  CONSTRAINT fk_devt_doc  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- =========================================
-- document_ai_chunks: testo estratto per embedding
-- =========================================
CREATE TABLE IF NOT EXISTS document_ai_chunks (
  id          CHAR(36)    PRIMARY KEY,
  document_id CHAR(36)    NOT NULL,
  owner_id    CHAR(36)    NOT NULL,
  chunk_index INT         NOT NULL DEFAULT 0,
  chunk_text  LONGTEXT    NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_chunk_document (document_id),
  INDEX idx_chunk_owner    (owner_id),
  CONSTRAINT fk_chunk_doc FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- =========================================
-- document_ai_embeddings: vettori embedding (JSON per piccoli dataset)
-- Per dataset grandi migrare a un vector DB esterno.
-- =========================================
CREATE TABLE IF NOT EXISTS document_ai_embeddings (
  id          CHAR(36)    PRIMARY KEY,
  chunk_id    CHAR(36)    NOT NULL UNIQUE,
  owner_id    CHAR(36)    NOT NULL,
  model       VARCHAR(128) NOT NULL DEFAULT 'text-embedding-3-small',
  embedding   JSON        NOT NULL COMMENT 'float array, len=1536 for text-embedding-3-small',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_emb_owner (owner_id),
  CONSTRAINT fk_emb_chunk FOREIGN KEY (chunk_id) REFERENCES document_ai_chunks(id) ON DELETE CASCADE
);

-- =========================================
-- deadlines: scadenziari (liberi, collegati a cliente o documento)
-- =========================================
CREATE TABLE IF NOT EXISTS deadlines (
  id          CHAR(36)     PRIMARY KEY,
  owner_id    CHAR(36)     NOT NULL,
  client_id   CHAR(36)     NULL,
  document_id CHAR(36)     NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT         NULL,
  due_at      DATETIME(3)  NOT NULL,
  priority    VARCHAR(16)  NOT NULL DEFAULT 'normal' COMMENT 'low, normal, high, urgent',
  status      VARCHAR(32)  NOT NULL DEFAULT 'open' COMMENT 'open, done, overdue, cancelled',
  reminder_at DATETIME(3)  NULL COMMENT 'quando inviare reminder (futuro)',
  completed_at DATETIME(3) NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_dl_owner    (owner_id),
  INDEX idx_dl_client   (client_id),
  INDEX idx_dl_document (document_id),
  INDEX idx_dl_due      (due_at),
  INDEX idx_dl_status   (status),
  CONSTRAINT fk_dl_owner    FOREIGN KEY (owner_id)    REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_dl_client   FOREIGN KEY (client_id)   REFERENCES clients(id)   ON DELETE SET NULL,
  CONSTRAINT fk_dl_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- =========================================
-- licenses: add updated_at column if not present
-- (needed for admin PATCH endpoint)
-- =========================================
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS metadata JSON NULL;

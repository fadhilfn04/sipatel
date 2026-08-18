-- ============================================
-- Phase 2: Create Batch Operation Log Table
-- ============================================
-- Creates a central logging table for all bulk operations
-- Tracks imports, exports, and other batch data operations

-- =========================================================
-- 1. CREATE BATCH OPERATION LOG TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS batch_operation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_type VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  total_records INT NOT NULL,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  error_summary TEXT,
  file_name VARCHAR(255),
  file_size_bytes BIGINT,
  file_md5_hash VARCHAR(32),
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, partial
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performer_ip VARCHAR(45), -- IPv6 compatible
  performer_user_agent TEXT,
  metadata JSONB, -- Flexible field for operation-specific data
  started_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- =========================================================
-- 2. CREATE INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_batch_log_operation_type
  ON batch_operation_log(operation_type);

CREATE INDEX IF NOT EXISTS idx_batch_log_table_name
  ON batch_operation_log(table_name);

CREATE INDEX IF NOT EXISTS idx_batch_log_performed_by
  ON batch_operation_log(performed_by);

CREATE INDEX IF NOT EXISTS idx_batch_log_status
  ON batch_operation_log(status);

CREATE INDEX IF NOT EXISTS idx_batch_log_started_at
  ON batch_operation_log(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_batch_log_performed_by_started
  ON batch_operation_log(performed_by, started_at DESC);

-- =========================================================
-- 3. CREATE ENUM FOR OPERATION TYPES
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_operation_type_enum') THEN
    CREATE TYPE batch_operation_type_enum AS ENUM (
      'import_anggota',
      'import_dana_kematian',
      'import_dana_sosial',
      'export_anggota',
      'export_dana_kematian',
      'export_dana_sosial',
      'bulk_update_anggota',
      'bulk_delete_anggota',
      'bulk_update_dana_kematian',
      'bulk_delete_dana_kematian',
      'data_migration',
      'data_sync',
      'other'
    );
  END IF;
END $$;

-- =========================================================
-- 4. ADD CONSTRAINT FOR OPERATION TYPE
-- =========================================================

-- Note: We keep operation_type as VARCHAR for flexibility
-- but can add CHECK constraint if needed

ALTER TABLE batch_operation_log
  ADD CONSTRAINT chk_operation_type_not_empty
  CHECK (TRIM(operation_type) != '');

ALTER TABLE batch_operation_log
  ADD CONSTRAINT chk_status_valid
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial'));

-- =========================================================
-- 5. CREATE UPDATED STATUS FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION update_batch_operation_status(
  p_log_id UUID,
  p_status VARCHAR,
  p_success_count INT DEFAULT NULL,
  p_failure_count INT DEFAULT NULL,
  p_error_summary TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE batch_operation_log
  SET
    status = p_status,
    success_count = COALESCE(p_success_count, success_count),
    failure_count = COALESCE(p_failure_count, failure_count),
    error_summary = COALESCE(p_error_summary, error_summary),
    completed_at = CASE
      WHEN p_status IN ('completed', 'failed', 'partial') THEN timezone('utc', now())
      ELSE completed_at
    END
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_batch_operation_status IS
  'Updates the status and results of a batch operation';

-- =========================================================
-- 6. CREATE LOGGING HELPER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION log_batch_operation(
  p_operation_type VARCHAR,
  p_table_name VARCHAR,
  p_total_records INT,
  p_file_name VARCHAR DEFAULT NULL,
  p_file_size_bytes BIGINT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO batch_operation_log (
    operation_type,
    table_name,
    total_records,
    file_name,
    file_size_bytes,
    performed_by,
    metadata,
    status,
    started_at
  ) VALUES (
    p_operation_type,
    p_table_name,
    p_total_records,
    p_file_name,
    p_file_size_bytes,
    p_performed_by,
    p_metadata,
    'running',
    timezone('utc', now())
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_batch_operation IS
  'Creates a new batch operation log entry and returns its ID';

-- =========================================================
-- 7. CREATE VIEW FOR OPERATION HISTORY
-- =========================================================

CREATE OR REPLACE VIEW batch_operation_history AS
SELECT
  bol.*,
  u.email AS performed_by_email,
  u.raw_user_meta_data->>'name' AS performed_by_name
FROM batch_operation_log bol
LEFT JOIN auth.users u ON bol.performed_by = u.id
ORDER BY bol.started_at DESC;

COMMENT ON VIEW batch_operation_history IS
  'View of batch operation logs with performer information';

-- =========================================================
-- 8. CREATE SUMMARY VIEW
-- =========================================================

CREATE OR REPLACE VIEW batch_operation_summary AS
SELECT
  DATE(started_at) AS operation_date,
  operation_type,
  table_name,
  COUNT(*) AS total_operations,
  SUM(total_records) AS total_records_processed,
  SUM(success_count) AS total_success,
  SUM(failure_count) AS total_failures,
  ROUND(100.0 * SUM(success_count) / NULLIF(SUM(total_records), 0), 2) AS success_rate_percentage
FROM batch_operation_log
WHERE status IN ('completed', 'partial', 'failed')
GROUP BY DATE(started_at), operation_type, table_name
ORDER BY operation_date DESC, operation_type;

COMMENT ON VIEW batch_operation_summary IS
  'Summary view of batch operations by date and type';

-- =========================================================
-- 9. CREATE VIEW FOR RECENT OPERATIONS
-- =========================================================

CREATE OR REPLACE VIEW recent_batch_operations AS
SELECT
  bol.id,
  bol.operation_type,
  bol.table_name,
  bol.status,
  bol.total_records,
  bol.success_count,
  bol.failure_count,
  bol.started_at,
  u.raw_user_meta_data->>'name' AS performed_by_name
FROM batch_operation_log bol
LEFT JOIN auth.users u ON bol.performed_by = u.id
WHERE bol.started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY bol.started_at DESC;

COMMENT ON VIEW recent_batch_operations IS
  'Recent batch operations from the last 7 days';

-- =========================================================
-- 10. UPDATE COMMENTS
-- =========================================================

COMMENT ON TABLE batch_operation_log IS
  'Central logging table for all bulk operations (imports, exports, batch updates). '
  'Tracks operation metadata, results, and performer information for audit purposes.';

COMMENT ON COLUMN batch_operation_log.id IS
  'Primary key UUID';

COMMENT ON COLUMN batch_operation_log.operation_type IS
  'Type of operation: import_anggota, export_dana_kematian, etc.';

COMMENT ON COLUMN batch_operation_log.table_name IS
  'Target table: anggota, dana_kematian, etc.';

COMMENT ON COLUMN batch_operation_log.total_records IS
  'Total number of records in the operation';

COMMENT ON COLUMN batch_operation_log.success_count IS
  'Number of records successfully processed';

COMMENT ON COLUMN batch_operation_log.failure_count IS
  'Number of records that failed processing';

COMMENT ON COLUMN batch_operation_log.error_summary IS
  'Summary of errors (can be detailed JSON or text)';

COMMENT ON COLUMN batch_operation_log.file_name IS
  'Original filename for import/export operations';

COMMENT ON COLUMN batch_operation_log.status IS
  'Operation status: pending, running, completed, failed, partial';

COMMENT ON COLUMN batch_operation_log.performed_by IS
  'User who initiated the operation (references auth.users)';

COMMENT ON COLUMN batch_operation_log.performer_ip IS
  'IP address of the performer for security audit';

COMMENT ON COLUMN batch_operation_log.metadata IS
  'Flexible JSONB field for operation-specific data';

-- =========================================================
-- 11. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================

ALTER TABLE batch_operation_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own operation logs
CREATE POLICY "Allow users to view own batch logs"
  ON batch_operation_log FOR SELECT
  TO authenticated
  USING (performed_by = current_setting('request.user.id', true)::UUID OR performed_by IS NULL);

-- Admins can view all logs
CREATE POLICY "Allow admins to view all batch logs"
  ON batch_operation_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "UserRole" ur
      JOIN "UserRolePermission" urp ON ur.id = urp."roleId"
      JOIN "UserPermission" up ON urp."permissionId" = up.id
      WHERE ur."slug" = 'administrator'
        AND up.slug = 'all_access'
    )
  );

-- =========================================================
-- 12. CREATE CLEANUP FUNCTION (OPTIONAL)
-- =========================================================

-- Function to clean up old logs (older than specified days)
CREATE OR REPLACE FUNCTION cleanup_old_batch_logs(days_to_keep INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM batch_operation_log
  WHERE started_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL
    AND status IN ('completed', 'failed');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_batch_logs IS
  'Cleans up old batch operation logs. Default keeps 90 days. Returns number of deleted rows.';

-- =========================================================
-- END OF MIGRATION
-- =========================================================

-- Usage Examples:

-- 1. Start logging an operation:
-- SELECT log_batch_operation('import_anggota', 'anggota', 500, 'data.xlsx', 1024000, 'user-uuid');

-- 2. Update operation status when complete:
-- SELECT update_batch_operation_status('log-id', 'completed', 450, 50, '5 rows failed validation');

-- 3. Clean up old logs:
-- SELECT cleanup_old_batch_logs(90);  -- Delete logs older than 90 days

-- Next: API implementation and Phase 2 verification script

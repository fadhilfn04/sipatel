-- Migration: Create anggota_history table for audit trail
-- This tracks all changes to anggota records for historical analysis and rollback

-- Create history table
CREATE TABLE IF NOT EXISTS anggota_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anggota_id UUID NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
  action VARCHAR(10) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  changed_by UUID REFERENCES auth.users(id),
  changed_data JSONB NOT NULL,
  previous_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_anggota_history_anggota_id ON anggota_history(anggota_id);
CREATE INDEX IF NOT EXISTS idx_anggota_history_created_at ON anggota_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anggota_history_action ON anggota_history(action);
CREATE INDEX IF NOT EXISTS idx_anggota_history_changed_by ON anggota_history(changed_by);

-- Add comments
COMMENT ON TABLE anggota_history IS 'Audit trail for all anggota record changes';
COMMENT ON COLUMN anggota_history.action IS 'Type of action: CREATE, UPDATE, or DELETE';
COMMENT ON COLUMN anggota_history.changed_by IS 'User who made the change';
COMMENT ON COLUMN anggota_history.changed_data IS 'New data after the change';
COMMENT ON COLUMN anggota_history.previous_data IS 'Data before the change (null for CREATE)';
COMMENT ON COLUMN anggota_history.changed_fields IS 'List of fields that were changed';

-- Create trigger function to automatically track changes
CREATE OR REPLACE FUNCTION track_anggota_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields TEXT[] := '{}';
  field_name TEXT;
BEGIN
  -- Determine which fields changed
  IF TG_OP = 'UPDATE' THEN
    -- Check each field for changes
    IF OLD.nik IS DISTINCT FROM NEW.nik THEN
      changed_fields := array_append(changed_fields, 'nik');
    END IF;
    IF OLD.nama_anggota IS DISTINCT FROM NEW.nama_anggota THEN
      changed_fields := array_append(changed_fields, 'nama_anggota');
    END IF;
    IF OLD.kategori_anggota IS DISTINCT FROM NEW.kategori_anggota THEN
      changed_fields := array_append(changed_fields, 'kategori_anggota');
    END IF;
    IF OLD.status_anggota IS DISTINCT FROM NEW.status_anggota THEN
      changed_fields := array_append(changed_fields, 'status_anggota');
    END IF;
    IF OLD.nama_cabang IS DISTINCT FROM NEW.nama_cabang THEN
      changed_fields := array_append(changed_fields, 'nama_cabang');
    END IF;
    IF OLD.kode_cabang IS DISTINCT FROM NEW.kode_cabang THEN
      changed_fields := array_append(changed_fields, 'kode_cabang');
    END IF;
    IF OLD.alamat IS DISTINCT FROM NEW.alamat THEN
      changed_fields := array_append(changed_fields, 'alamat');
    END IF;
    IF OLD.nomor_handphone IS DISTINCT FROM NEW.nomor_handphone THEN
      changed_fields := array_append(changed_fields, 'nomor_handphone');
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      changed_fields := array_append(changed_fields, 'email');
    END IF;
    -- Add more fields as needed

    INSERT INTO anggota_history (
      anggota_id,
      action,
      changed_by,
      changed_data,
      previous_data,
      changed_fields
    ) VALUES (
      NEW.id,
      'UPDATE',
      auth.uid(),
      row_to_json(NEW),
      row_to_json(OLD),
      changed_fields
    );

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO anggota_history (
      anggota_id,
      action,
      changed_by,
      changed_data,
      previous_data,
      changed_fields
    ) VALUES (
      OLD.id,
      'DELETE',
      auth.uid(),
      row_to_json(OLD),
      NULL,
      ARRAY['*']::TEXT[]
    );

    RETURN OLD;

  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO anggota_history (
      anggota_id,
      action,
      changed_by,
      changed_data,
      previous_data,
      changed_fields
    ) VALUES (
      NEW.id,
      'CREATE',
      auth.uid(),
      row_to_json(NEW),
      NULL,
      ARRAY['*']::TEXT[]
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS track_anggota_insert ON anggota;
CREATE TRIGGER track_anggota_insert
  AFTER INSERT ON anggota
  FOR EACH ROW
  EXECUTE FUNCTION track_anggota_changes();

DROP TRIGGER IF EXISTS track_anggota_update ON anggota;
CREATE TRIGGER track_anggota_update
  AFTER UPDATE ON anggota
  FOR EACH ROW
  WHEN (OLD IS DISTINCT FROM NEW)
  EXECUTE FUNCTION track_anggota_changes();

DROP TRIGGER IF EXISTS track_anggota_delete ON anggota;
CREATE TRIGGER track_anggota_delete
  AFTER DELETE ON anggota
  FOR EACH ROW
  EXECUTE FUNCTION track_anggota_changes();
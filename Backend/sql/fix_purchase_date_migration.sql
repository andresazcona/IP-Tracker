-- Migration to fix purchase_date column issue
-- This script will add the purchase_date column to devices table if needed

-- Add purchase_date column to devices table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'devices' 
        AND column_name = 'purchase_date'
    ) THEN
        ALTER TABLE devices ADD COLUMN purchase_date DATE;
        
        -- Add comment
        COMMENT ON COLUMN devices.purchase_date IS 'Date when the device was purchased';
        
        -- Log the change
        RAISE NOTICE 'Added purchase_date column to devices table';
    ELSE
        RAISE NOTICE 'Column purchase_date already exists in devices table';
    END IF;
END $$;

-- Update updated_at timestamp trigger to include the new column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Make sure the trigger exists for devices table
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
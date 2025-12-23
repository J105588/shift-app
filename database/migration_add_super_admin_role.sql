-- Add super_admin to the allowed roles in profiles table
-- First, drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Then recreate it with the new role included
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'staff', 'super_admin'));

ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_grp_check;
ALTER TABLE topics ADD CONSTRAINT topics_grp_check CHECK (grp IN ('company', 'field', 'cross', 'genre'));

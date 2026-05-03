ALTER TABLE projects ADD COLUMN team_lead TEXT;
ALTER TABLE projects ADD COLUMN team_members TEXT DEFAULT '[]';

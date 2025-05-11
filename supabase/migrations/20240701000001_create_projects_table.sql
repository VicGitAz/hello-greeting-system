-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_versions table to store version history
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  prompt TEXT,
  code_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flow_diagrams table
CREATE TABLE IF NOT EXISTS flow_diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  diagram_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_diagrams ENABLE ROW LEVEL SECURITY;

-- Projects policies
DROP POLICY IF EXISTS "Users can view their own projects";
CREATE POLICY "Users can view their own projects" ON projects FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own projects";
CREATE POLICY "Users can insert their own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own projects";
CREATE POLICY "Users can update their own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own projects";
CREATE POLICY "Users can delete their own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Project versions policies
DROP POLICY IF EXISTS "Users can view their own project versions";
CREATE POLICY "Users can view their own project versions" ON project_versions FOR SELECT USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_versions.project_id));

DROP POLICY IF EXISTS "Users can insert their own project versions";
CREATE POLICY "Users can insert their own project versions" ON project_versions FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM projects WHERE id = project_versions.project_id));

-- Chat history policies
DROP POLICY IF EXISTS "Users can view their own chat history";
CREATE POLICY "Users can view their own chat history" ON chat_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chat messages";
CREATE POLICY "Users can insert their own chat messages" ON chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Flow diagrams policies
DROP POLICY IF EXISTS "Users can view their own flow diagrams";
CREATE POLICY "Users can view their own flow diagrams" ON flow_diagrams FOR SELECT USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = flow_diagrams.project_id));

DROP POLICY IF EXISTS "Users can insert their own flow diagrams";
CREATE POLICY "Users can insert their own flow diagrams" ON flow_diagrams FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM projects WHERE id = flow_diagrams.project_id));

DROP POLICY IF EXISTS "Users can update their own flow diagrams";
CREATE POLICY "Users can update their own flow diagrams" ON flow_diagrams FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM projects WHERE id = flow_diagrams.project_id));

alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table project_versions;
alter publication supabase_realtime add table chat_history;
alter publication supabase_realtime add table flow_diagrams;
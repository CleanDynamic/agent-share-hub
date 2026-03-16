export type AgentStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  creator_id: string;
  title: string;
  slug: string;
  description: string;
  instructions: string;
  model_compatibility: string[];
  price: number;
  status: AgentStatus;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: Profile;
  tags?: Tag[];
}

export interface AgentFile {
  id: string;
  agent_id: string;
  file_path: string;
  version: string;
  file_size: number;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Download {
  id: string;
  user_id: string;
  agent_id: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  agent_id: string;
  stripe_session_id: string;
  created_at: string;
}

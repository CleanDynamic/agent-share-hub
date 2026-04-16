// Document editor domain types. These interfaces mirror the Supabase schema
// defined in supabase/migrations/20260416000001_document_editing_system.sql.

export type StageBackgroundStyle = 'dot' | 'line' | 'solid';
export type StageWidthMode = 'narrow' | 'wide' | 'full';

export type BlockType =
  | 'text'
  | 'heading'
  | 'prompt'
  | 'code'
  | 'result'
  | 'image'
  | 'video'
  | 'agent'
  | 'workflow'
  | 'compare'
  | 'tool'
  | 'model'
  | 'tutorial'
  | 'resource'
  | 'note'
  | 'quote';

export type ConnectionPort = 'top' | 'right' | 'bottom' | 'left';

export type ConnectionType =
  | 'feeds_into'
  | 'alternative_to'
  | 'depends_on'
  | 'contradicts'
  | 'references'
  | 'custom';

export interface Stage {
  id: string;
  content_item_id: string;
  order_in_document: number;
  grid_spacing: number;
  background_style: StageBackgroundStyle;
  width_mode: StageWidthMode;
  height: number;
  stage_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  stage_id: string;
  type: BlockType;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  name: string | null;
  properties: Record<string, unknown>;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  from_block_id: string;
  to_block_id: string;
  from_port: ConnectionPort;
  to_port: ConnectionPort;
  connection_type: ConnectionType;
  label: string | null;
  carries_data: boolean;
  created_at: string;
}

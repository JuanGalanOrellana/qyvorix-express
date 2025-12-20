import { RowDataPacket } from 'mysql2';

export interface UserMeRow extends RowDataPacket {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string;
  email_verified: boolean | 0 | 1 | '0' | '1';
  register_time: string;
  total_xp: number;
  influence_total: number;
  power_majority_hits: number;
  power_participations: number;
  power_pct: number;
  streak_days: number;
  last_participation_date: string | null;
  weekly_grace_tokens: number;
  updated_at: string;
}

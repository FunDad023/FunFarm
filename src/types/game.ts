export type CropKey = 'wheat' | 'tomato' | 'golden_pumpkin' | 'crystal_berry';
export type ItemType = 'seed' | 'crop';
export type ActionType = 'message' | 'water' | 'steal';

export interface CropDefinition {
  key: CropKey;
  name: string;
  emoji: string;
  seedPrice: number;
  growSeconds: number;
  sellPrice: number;
  exp: number;
  color: string;
}

export const CROPS: CropDefinition[] = [
  { key: 'wheat', name: 'Lúa mì', emoji: '🌾', seedPrice: 10, growSeconds: 30, sellPrice: 25, exp: 5, color: '#eabf69' },
  { key: 'tomato', name: 'Cà chua', emoji: '🍅', seedPrice: 30, growSeconds: 120, sellPrice: 75, exp: 15, color: '#e68168' },
  { key: 'golden_pumpkin', name: 'Bí ngô vàng', emoji: '🎃', seedPrice: 80, growSeconds: 300, sellPrice: 210, exp: 40, color: '#e9a84e' },
  { key: 'crystal_berry', name: 'Dâu pha lê', emoji: '🫐', seedPrice: 200, growSeconds: 900, sellPrice: 550, exp: 100, color: '#967dd8' },
];

export const cropByKey = (key: string | null | undefined) => CROPS.find((crop) => crop.key === key);

export interface Profile {
  id: string;
  username: string;
  gold: number;
  exp: number;
  level: number;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  item_type: ItemType;
  item_key: CropKey;
  quantity: number;
}

export interface Plot {
  id: string;
  user_id: string;
  plot_index: number;
  is_unlocked: boolean;
  crop_key: CropKey | null;
  planted_at: string | null;
  harvest_at: string | null;
  is_watered: boolean;
  is_stolen: boolean;
}

export interface GuestbookEntry {
  id: string;
  island_owner_id: string;
  visitor_username: string;
  action_type: ActionType;
  content: string;
  created_at: string;
}

export interface Neighbor extends Profile {
  online: boolean;
}

export type FarmAction = 'plant_seed' | 'water_plot' | 'harvest_crop' | 'steal_crop' | 'buy_seed' | 'sell_crop' | 'unlock_plot' | 'leave_message';

export function expForNextLevel(_level: number) { return 100; }

export function formatTimeLeft(target: string | null) {
  if (!target) return '—';
  const seconds = Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

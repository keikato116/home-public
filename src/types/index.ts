export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface RoutineDefinition {
  id: string;
  household_id: string;
  user_id: string | null;
  label: string;
  frequency: "daily" | "weekly" | "monthly" | "once";
  day_of_week: number | null;
  day_of_month: number | null;
  due_date: string | null;
  /** 通知する時刻（"HH:MM:SS"）。null なら端末側の既定の時刻を使う。 */
  notify_at: string | null;
  order: number;
}

export interface RoutineTodo extends RoutineDefinition {
  done: boolean;
  overdue: boolean;
}

export interface SharedTodo {
  id: string;
  household_id: string;
  label: string;
  done: boolean;
  created_by: string | null;
  created_at: string;
  order: number;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  user_id: string | null;
  label: string;
  category: string;
  done: boolean;
  order: number;
  date: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  url: string | null;
  ingredients: string | null;
  thumbnail_url: string | null;
  photo_urls: string[] | null;
  cook_time_min: number | null;
  servings: number | null;
  category: string | null;
  subcategory: string | null;
  memo: string | null;
  times_made: number;
  last_made_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  date: string;
  meal_type: "dinner" | "lunch";
  recipe_id: string | null;
  label: string | null;
  created_at: string;
}

// A highlight plan is a row with both recipe_id and label null.
export function isHighlightPlan(p: MealPlan, mealType: "dinner" | "lunch"): boolean {
  return p.meal_type === mealType && p.recipe_id === null && p.label === null;
}

export interface CalendarSettings {
  household_id: string;
  selected_colors: string[];
  start_date: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  colorId?: string;
  calendarColor?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  ownerId?: string;
  ownerName?: string;
  isLocal?: boolean;
}

export interface LocalCalendarEvent {
  id: string;
  household_id: string;
  user_id: string | null;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}


export interface WeatherData {
  icon: string;
  temp: number;
  description: string;
  rain1h: number | null;
}

export interface SplitItem {
  name: string;
  price: number;
}

export interface SplitSession {
  id: string;
  household_id: string;
  date: string;
  store: string;
  card: "mine" | "family";
  items: SplitItem[];
  shared_amount: number;
  // Per-session her share (0-1); null falls back to the household default
  her_ratio?: number | null;
  created_at: string;
}

export interface FamilyCardTotal {
  id: string;
  household_id: string;
  year: number;
  month: number;
  total: number;
}

export interface SplitSubscription {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  card: "mine" | "family";
  active: boolean;
  created_at: string;
}

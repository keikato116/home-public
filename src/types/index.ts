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
  order: number;
}

export interface RoutineTodo extends RoutineDefinition {
  done: boolean;
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
  label: string;
  category: string;
  done: boolean;
  order: number;
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  source_type: "url" | "photo" | "manual";
  url: string | null;
  photo_path: string | null;
  ingredients: string | null;
  steps: string | null;
  thumbnail_url: string | null;
  cook_time_min: number | null;
  servings: number | null;
  category: string | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
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

export interface DiaryEntry {
  id: string;
  household_id: string;
  user_id: string | null;
  author_name: string | null;
  content: string;
  entry_date: string;
  created_at: string;
}

export interface WeatherData {
  icon: string;
  temp: number;
  description: string;
  rain1h: number | null;
}

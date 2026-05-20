export interface Meal {
  id: string;
  name: string;
  calories: number;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface DailySummary {
  date: string;
  totalCalories: number;
  meals: Meal[];
}

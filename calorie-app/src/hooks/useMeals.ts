import { useState, useEffect } from 'react';
import type { Meal, DailySummary } from '../types';

const STORAGE_KEY = 'calorie-meals';

export function useMeals() {
  const [meals, setMeals] = useState<Meal[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  }, [meals]);

  const addMeal = (name: string, calories: number, date: string) => {
    const meal: Meal = {
      id: crypto.randomUUID(),
      name,
      calories,
      date,
      createdAt: Date.now(),
    };
    setMeals((prev) => [...prev, meal]);
  };

  const deleteMeal = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const getDailySummary = (date: string): DailySummary => {
    const dayMeals = meals.filter((m) => m.date === date);
    return {
      date,
      totalCalories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
      meals: dayMeals.sort((a, b) => a.createdAt - b.createdAt),
    };
  };

  const getWeeklySummaries = (referenceDate: string): DailySummary[] => {
    const ref = new Date(referenceDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(ref.getDate() - 6 + i);
      const dateStr = d.toISOString().slice(0, 10);
      return getDailySummary(dateStr);
    });
  };

  return { meals, addMeal, deleteMeal, getDailySummary, getWeeklySummaries };
}

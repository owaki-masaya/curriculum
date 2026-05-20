import type { Meal } from '../types';

interface Props {
  meals: Meal[];
  onDelete: (id: string) => void;
}

export function MealList({ meals, onDelete }: Props) {
  if (meals.length === 0) {
    return <p className="empty-message">まだ食事が記録されていません</p>;
  }

  return (
    <ul className="meal-list">
      {meals.map((meal) => (
        <li key={meal.id} className="meal-item">
          <span className="meal-name">{meal.name}</span>
          <span className="meal-calories">{meal.calories} kcal</span>
          <button
            onClick={() => onDelete(meal.id)}
            className="btn-delete"
            aria-label="削除"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

import { useState } from 'react';

interface Props {
  selectedDate: string;
  onAdd: (name: string, calories: number, date: string) => void;
}

export function MealForm({ selectedDate, onAdd }: Props) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cal = parseInt(calories, 10);
    if (!name.trim() || isNaN(cal) || cal <= 0) return;
    onAdd(name.trim(), cal, selectedDate);
    setName('');
    setCalories('');
  };

  return (
    <form onSubmit={handleSubmit} className="meal-form">
      <h3>食事を追加</h3>
      <div className="form-row">
        <input
          type="text"
          placeholder="食事名（例：ご飯、サラダ）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-name"
          required
        />
        <input
          type="number"
          placeholder="カロリー (kcal)"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          className="input-calories"
          min="1"
          required
        />
        <button type="submit" className="btn-add">追加</button>
      </div>
    </form>
  );
}

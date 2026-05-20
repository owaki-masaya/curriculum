import { useState } from 'react';
import { useMeals } from './hooks/useMeals';
import { MealForm } from './components/MealForm';
import { MealList } from './components/MealList';
import { CalorieSummary } from './components/CalorieSummary';
import { WeeklyChart } from './components/WeeklyChart';
import './App.css';

const DEFAULT_TARGET = 2000;

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const today = toDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [targetCalories, setTargetCalories] = useState(DEFAULT_TARGET);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(DEFAULT_TARGET));

  const { addMeal, deleteMeal, getDailySummary, getWeeklySummaries } = useMeals();
  const summary = getDailySummary(selectedDate);
  const weeklySummaries = getWeeklySummaries(today);

  const handleTargetSave = () => {
    const val = parseInt(targetInput, 10);
    if (!isNaN(val) && val > 0) setTargetCalories(val);
    setEditingTarget(false);
  };

  const handleDateChange = (direction: -1 | 1) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    if (d <= new Date()) setSelectedDate(toDateString(d));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>カロリー管理</h1>
        <div className="target-setting">
          <span>目標: </span>
          {editingTarget ? (
            <>
              <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="target-input"
                min="1"
              />
              <button onClick={handleTargetSave} className="btn-save">保存</button>
            </>
          ) : (
            <>
              <strong>{targetCalories} kcal</strong>
              <button onClick={() => setEditingTarget(true)} className="btn-edit">編集</button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <section className="section-chart">
          <WeeklyChart
            summaries={weeklySummaries}
            targetCalories={targetCalories}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </section>

        <section className="section-day">
          <div className="date-nav">
            <button onClick={() => handleDateChange(-1)} className="btn-nav">◀</button>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-picker"
            />
            <button
              onClick={() => handleDateChange(1)}
              className="btn-nav"
              disabled={selectedDate >= today}
            >▶</button>
          </div>

          <CalorieSummary
            totalCalories={summary.totalCalories}
            targetCalories={targetCalories}
          />

          <MealForm selectedDate={selectedDate} onAdd={addMeal} />

          <MealList meals={summary.meals} onDelete={deleteMeal} />
        </section>
      </main>
    </div>
  );
}

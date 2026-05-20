interface Props {
  totalCalories: number;
  targetCalories: number;
}

export function CalorieSummary({ totalCalories, targetCalories }: Props) {
  const percentage = Math.min((totalCalories / targetCalories) * 100, 100);
  const remaining = targetCalories - totalCalories;
  const isOver = totalCalories > targetCalories;

  return (
    <div className="calorie-summary">
      <div className="summary-numbers">
        <div className="summary-item">
          <span className="summary-label">摂取済み</span>
          <span className="summary-value consumed">{totalCalories} kcal</span>
        </div>
        <div className="summary-divider">/</div>
        <div className="summary-item">
          <span className="summary-label">目標</span>
          <span className="summary-value target">{targetCalories} kcal</span>
        </div>
        <div className="summary-item remaining">
          <span className="summary-label">{isOver ? '超過' : '残り'}</span>
          <span className={`summary-value ${isOver ? 'over' : 'remaining-val'}`}>
            {Math.abs(remaining)} kcal
          </span>
        </div>
      </div>
      <div className="progress-bar-container">
        <div
          className={`progress-bar ${isOver ? 'over' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

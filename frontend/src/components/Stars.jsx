// Star rating display (supports halves, e.g. 4.5) and a clickable 1–5 star input
export default function Stars({ value, size = 16 }) {
  return (
    <span className="stars" style={{ '--size': `${size}px` }} aria-label={`${value} out of 5 stars`}>
      <span className="stars-fill" style={{ width: `${(value / 5) * 100}%` }}>★★★★★</span>
      ★★★★★
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <span className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </span>
  );
}

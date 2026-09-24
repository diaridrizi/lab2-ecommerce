// − [ 2 ] +  quantity control used on the product page, in the cart and in the mini cart
export default function QtyStepper({ value, max, onChange, disabled = false, small = false, label = 'Quantity' }) {
  const set = (n) => {
    const next = Math.max(1, Math.min(max ?? Infinity, n));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`qty ${small ? 'qty-sm' : ''}`}>
      <button type="button" onClick={() => set(value - 1)} disabled={disabled || value <= 1} aria-label={`Decrease ${label}`}>−</button>
      <input
        type="number"
        min="1"
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value) || 1)}
        aria-label={label}
      />
      <button type="button" onClick={() => set(value + 1)} disabled={disabled || (max != null && value >= max)} aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

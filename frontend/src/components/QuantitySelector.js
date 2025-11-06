import { useCallback } from 'react';

export default function QuantitySelector({ value, onChange, max, min = 1, small }) {
  const dec = useCallback(() => onChange(Math.max(min, value - 1)), [value, onChange, min]);
  const inc = useCallback(() => onChange(Math.min(max ?? Infinity, value + 1)), [value, onChange, max]);

  return (
    <div className={`qty ${small ? 'qty-sm' : ''}`}> 
      <button type="button" onClick={dec} disabled={value <= min} aria-label="Decrease quantity">−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) {
              if (max) onChange(Math.min(Math.max(v, min), max)); else onChange(Math.max(v, min));
            }
        }}
        aria-label="Quantity"
      />
      <button type="button" onClick={inc} disabled={max != null && value >= max} aria-label="Increase quantity">+</button>
    </div>
  );
}

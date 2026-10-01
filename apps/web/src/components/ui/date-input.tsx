'use client';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';
import { displayDate, parseDateInput } from '@/domain/date-input';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & {
  type?: 'date' | 'datetime-local';
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  onValueChange?: (value: string) => void;
};

export function DateInput({
  type = 'date',
  value,
  defaultValue = '',
  onValueChange,
  name,
  min,
  max,
  disabled,
  readOnly,
  ...props
}: Props) {
  const [text, setText] = useState(() => displayDate(value ?? defaultValue));
  const [previousValue, setPreviousValue] = useState(value);
  if (value !== previousValue) {
    setPreviousValue(value);
    setText(displayDate(value ?? ''));
  }
  const field = useRef<HTMLInputElement>(null);
  const calendar = useRef<HTMLInputElement>(null);
  const withTime = type === 'datetime-local';
  const format = withTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY';
  const iso = parseDateInput(text, withTime);
  const error =
    iso === null
      ? `Enter a valid date in ${format} format.`
      : iso && min && iso < min
        ? `Choose ${displayDate(min)} or later.`
        : iso && max && iso > max
          ? `Choose ${displayDate(max)} or earlier.`
          : '';

  useEffect(() => {
    field.current?.setCustomValidity(error);
  }, [error]);
  useEffect(() => {
    const form = field.current?.form;
    const reset = () => {
      if (value === undefined) setText(displayDate(defaultValue));
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue, value]);

  function update(next: string) {
    setText(next);
    const parsed = parseDateInput(next, withTime);
    if (parsed !== null) onValueChange?.(parsed);
  }
  return (
    <span className="date-input">
      <input
        {...props}
        ref={field}
        type="text"
        placeholder={format}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? true : props['aria-invalid']}
        onChange={(event) => update(event.target.value)}
      />
      <input type="hidden" name={name} value={iso ?? ''} disabled={disabled} />
      <input
        ref={calendar}
        className="date-input-calendar"
        type={type}
        tabIndex={-1}
        aria-hidden="true"
        aria-label="Calendar date"
        value={iso ?? ''}
        min={min}
        max={max}
        disabled={disabled || readOnly}
        onChange={(event) => update(displayDate(event.target.value))}
      />
      <button
        type="button"
        className="date-input-button"
        aria-label="Open calendar"
        disabled={disabled || readOnly}
        onClick={() => calendar.current?.showPicker()}
      >
        <CalendarDays size={18} aria-hidden="true" />
      </button>
    </span>
  );
}

"use client";

import { useState, useRef, useEffect } from 'react';

type TimePickerProps = {
  value: string; // HH:MM format (24h)
  onChange: (time: string) => void;
  selectedDate?: string; // YYYY-MM-DD format (unused but kept for API compatibility)
};

export function TimePicker({ value, onChange }: TimePickerProps) {
  // Parse initial value
  const parseValue = (val: string): { readonly hour: string; readonly minute: string; readonly period: 'AM' | 'PM' } => {
    if (!val) return { hour: '', minute: '', period: 'AM' };
    const [hourStr, minuteStr] = val.split(':');
    const hour24 = parseInt(hourStr, 10);
    const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return {
      hour: String(hour12).padStart(2, '0'),
      minute: minuteStr || '00',
      period
    };
  };

  const initial = parseValue(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);
  
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  // Update parent when values change
  useEffect(() => {
    if (hour && minute) {
      let hour24 = parseInt(hour, 10);
      
      // Convert to 24-hour format
      if (period === 'AM') {
        if (hour24 === 12) hour24 = 0;
      } else {
        if (hour24 !== 12) hour24 += 12;
      }
      
      const time24 = `${String(hour24).padStart(2, '0')}:${minute}`;
      onChange(time24);
    }
  }, [hour, minute, period, onChange]);

  function handleHourChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '');
    
    if (val === '') {
      setHour('');
      return;
    }

    const num = parseInt(val, 10);
    
    // Single digit: pad with 0 and show
    if (val.length === 1) {
      if (num >= 2 && num <= 9) {
        // 2-9 becomes 02-09, auto-advance to minutes
        setHour(val.padStart(2, '0'));
        setTimeout(() => minuteRef.current?.focus(), 0);
      } else {
        // 0 or 1, wait for second digit
        setHour(val);
      }
    } else if (val.length === 2) {
      // Two digits
      if (num >= 1 && num <= 12) {
        setHour(val.padStart(2, '0'));
        setTimeout(() => minuteRef.current?.focus(), 0);
      } else if (num > 12) {
        // If they typed something like 13+, take just the first valid digit
        setHour('01');
        setTimeout(() => minuteRef.current?.focus(), 0);
      }
    }
  }

  function handleHourBlur() {
    if (hour) {
      const num = parseInt(hour, 10);
      if (num >= 1 && num <= 12) {
        setHour(String(num).padStart(2, '0'));
      } else if (num === 0) {
        setHour('12');
      } else {
        setHour('');
      }
    }
  }

  function handleMinuteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '');
    
    if (val === '') {
      setMinute('');
      return;
    }

    const num = parseInt(val, 10);
    
    if (val.length === 1) {
      if (num >= 6) {
        // 6-9 becomes 06-09 (invalid minute start), treat as 0X
        setMinute('0' + val.slice(0, 1));
      } else {
        setMinute(val);
      }
    } else if (val.length >= 2) {
      const twoDigit = val.slice(0, 2);
      const twoDigitNum = parseInt(twoDigit, 10);
      if (twoDigitNum <= 59) {
        setMinute(twoDigit.padStart(2, '0'));
      } else {
        setMinute('59');
      }
    }
  }

  function handleMinuteBlur() {
    if (minute) {
      const num = parseInt(minute, 10);
      if (num >= 0 && num <= 59) {
        setMinute(String(num).padStart(2, '0'));
      } else {
        setMinute('00');
      }
    } else {
      setMinute('00');
    }
  }

  function handleHourKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const num = parseInt(hour || '0', 10);
      const next = num >= 12 ? 1 : num + 1;
      setHour(String(next).padStart(2, '0'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const num = parseInt(hour || '0', 10);
      const next = num <= 1 ? 12 : num - 1;
      setHour(String(next).padStart(2, '0'));
    } else if (e.key === ':' || e.key === 'ArrowRight') {
      e.preventDefault();
      minuteRef.current?.focus();
    }
  }

  function handleMinuteKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const num = parseInt(minute || '0', 10);
      const next = num >= 59 ? 0 : num + 1;
      setMinute(String(next).padStart(2, '0'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const num = parseInt(minute || '0', 10);
      const next = num <= 0 ? 59 : num - 1;
      setMinute(String(next).padStart(2, '0'));
    } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      hourRef.current?.focus();
    } else if (e.key === 'Backspace' && minute === '') {
      e.preventDefault();
      hourRef.current?.focus();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 px-2">
        <input
          ref={hourRef}
          type="text"
          inputMode="numeric"
          value={hour}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          onKeyDown={handleHourKeyDown}
          placeholder="00"
          maxLength={2}
          className="w-7 bg-transparent py-2 text-center text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
        <span className="text-zinc-500">:</span>
        <input
          ref={minuteRef}
          type="text"
          inputMode="numeric"
          value={minute}
          onChange={handleMinuteChange}
          onBlur={handleMinuteBlur}
          onKeyDown={handleMinuteKeyDown}
          placeholder="00"
          maxLength={2}
          className="w-7 bg-transparent py-2 text-center text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
      </div>

      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value as 'AM' | 'PM')}
        className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

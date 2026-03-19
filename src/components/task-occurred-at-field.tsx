"use client";

function formatDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskOccurredAtField() {
  return (
    <label className="form-field">
      <span>Fecha y hora</span>
      <input name="occurred_at" type="datetime-local" defaultValue={formatDateTimeLocalValue(new Date())} required />
    </label>
  );
}

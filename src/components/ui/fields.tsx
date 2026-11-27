import type { ReactNode } from 'react';

// Labelled form controls (UI_UX.md §6): visible labels, hints and errors linked
// with aria-describedby, aria-invalid on error. Native controls only.

const describedBy = (...ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(' ') || undefined;

function Message({ id, error }: { id: string; error: string }) {
  return (
    <p id={id} className="mt-1 text-sm font-medium text-aqi-very-poor dark:text-text">
      <span aria-hidden="true">⚠ </span>
      {error}
    </p>
  );
}

function Hint({ id, hint }: { id: string; hint: string }) {
  return (
    <p id={id} className="text-sm text-muted">
      {hint}
    </p>
  );
}

const CONTROL =
  'mt-1 block min-h-11 w-full rounded-md border border-muted bg-surface px-3 text-base text-text aria-[invalid=true]:border-2 aria-[invalid=true]:border-aqi-very-poor';

interface BaseProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

interface TextFieldProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'time';
  inputMode?: 'decimal' | 'numeric' | 'text';
  maxLength?: number;
  autoComplete?: string;
}

export function TextField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  type = 'text',
  inputMode,
  maxLength,
  autoComplete = 'off',
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {hint && <Hint id={`${id}-hint`} hint={hint} />}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && `${id}-hint`, error && `${id}-error`)}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={CONTROL}
      />
      {error && <Message id={`${id}-error`} error={error} />}
    </div>
  );
}

interface SelectFieldProps<T extends string> extends BaseProps {
  value: T | '';
  onChange: (value: T | '') => void;
  options: readonly (readonly [T, string])[];
  placeholder?: string;
}

export function SelectField<T extends string>({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
}: SelectFieldProps<T>) {
  return (
    <div>
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      {hint && <Hint id={`${id}-hint`} hint={hint} />}
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint && `${id}-hint`, error && `${id}-error`)}
        onChange={(event) => {
          onChange(event.target.value as T | '');
        }}
        className={CONTROL}
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error && <Message id={`${id}-error`} error={error} />}
    </div>
  );
}

interface ChoiceGroupProps<T extends string> {
  id: string;
  legend: string;
  hint?: string | undefined;
  error?: string | undefined;
  options: readonly (readonly [T, string])[];
  /** Pill-style layout for short multi-select lists (personas, masks). */
  chips?: boolean;
}

function ChoiceFieldset({
  id,
  legend,
  hint,
  error,
  chips,
  children,
}: Omit<ChoiceGroupProps<string>, 'options'> & { children: ReactNode }) {
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(hint && `${id}-hint`, error && `${id}-error`)}
      className="focus:outline-none"
    >
      <legend className="font-medium">{legend}</legend>
      {hint && <Hint id={`${id}-hint`} hint={hint} />}
      <div
        className={`mt-2 flex flex-wrap gap-2 ${chips ? '' : 'flex-col sm:flex-row sm:gap-x-6'}`}
      >
        {children}
      </div>
      {error && <Message id={`${id}-error`} error={error} />}
    </fieldset>
  );
}

const CHIP =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-muted px-4 has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-on-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent';
const PLAIN = 'flex min-h-11 cursor-pointer items-center gap-2';

interface CheckboxGroupProps<T extends string> extends ChoiceGroupProps<T> {
  values: readonly T[];
  onChange: (values: T[]) => void;
}

export function CheckboxGroup<T extends string>({
  values,
  onChange,
  options,
  ...rest
}: CheckboxGroupProps<T>) {
  return (
    <ChoiceFieldset {...rest}>
      {options.map(([value, label]) => (
        <label key={value} className={rest.chips ? CHIP : PLAIN}>
          <input
            type="checkbox"
            className={rest.chips ? 'sr-only' : 'size-5 accent-accent'}
            checked={values.includes(value)}
            onChange={(event) => {
              onChange(
                event.target.checked ? [...values, value] : values.filter((v) => v !== value),
              );
            }}
          />
          {label}
        </label>
      ))}
    </ChoiceFieldset>
  );
}

interface RadioGroupProps<T extends string> extends ChoiceGroupProps<T> {
  name: string;
  value: T | '';
  onChange: (value: T) => void;
}

export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  ...rest
}: RadioGroupProps<T>) {
  return (
    <ChoiceFieldset {...rest}>
      {options.map(([optionValue, label]) => (
        <label key={optionValue} className={PLAIN}>
          <input
            type="radio"
            name={name}
            className="size-5 accent-accent"
            checked={value === optionValue}
            onChange={() => {
              onChange(optionValue);
            }}
          />
          {label}
        </label>
      ))}
    </ChoiceFieldset>
  );
}

interface CheckboxProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ id, label, hint, checked, onChange }: CheckboxProps) {
  return (
    <div>
      <label htmlFor={id} className={PLAIN}>
        <input
          id={id}
          type="checkbox"
          className="size-5 accent-accent"
          checked={checked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
        <span className="font-medium">{label}</span>
      </label>
      {hint && <Hint id={`${id}-hint`} hint={hint} />}
    </div>
  );
}

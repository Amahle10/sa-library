import { useState, type ReactNode, type FormEvent } from 'react';
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      {value.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
export function date(value?: string) {
  return value
    ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '—';
}
export function PageTitle({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
export function ResourceState({ resource }: { resource: { loading: boolean; error: string } }) {
  return resource.loading ? (
    <p role="status" className="empty">
      Loading…
    </p>
  ) : (
    <ErrorMessage message={resource.error} />
  );
}
export function Action({
  children,
  run,
  onDone,
  className = 'button secondary',
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  onDone?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span className="action">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await run();
            onDone?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Action failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Working…' : children}
      </button>
      <ErrorMessage message={error} />
    </span>
  );
}
export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'textarea' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
  initial?: string;
  minLength?: number;
  maxLength?: number;
}
export function DataForm({
  fields,
  submit,
  label,
  onDone,
  reset = false,
}: {
  fields: Field[];
  submit: (data: Record<string, string>) => Promise<unknown>;
  label: string;
  onDone?: () => void;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await submit(data);
      if (reset) form.reset();
      setSuccess('Saved successfully.');
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={handle} className="data-form">
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.type === 'select' ? (
              <select
                aria-label={field.label}
                name={field.name}
                defaultValue={field.initial ?? ''}
                required={field.required}
              >
                <option value="">Choose…</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                name={field.name}
                defaultValue={field.initial}
                maxLength={field.maxLength ?? 5000}
              />
            ) : (
              <input
                name={field.name}
                type={field.type ?? 'text'}
                defaultValue={field.initial}
                required={field.required}
                minLength={field.minLength}
                maxLength={field.maxLength ?? 240}
                autoComplete={field.type === 'password' ? 'current-password' : undefined}
              />
            )}
          </label>
        ))}
      </div>
      <ErrorMessage message={error} />
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
      <button disabled={busy} className="button">
        {busy ? 'Saving…' : label}
      </button>
    </form>
  );
}
export function compact(data: Record<string, string>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== ''));
}

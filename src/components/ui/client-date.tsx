interface ClientDateProps {
  value: string;
  format?: 'date' | 'dateTime';
  locale?: string;
}

export function ClientDate({
  value,
  format = 'date',
  locale = 'pl-PL',
}: ClientDateProps) {
  const date = new Date(value);
  const formatted =
    format === 'dateTime'
      ? date.toLocaleString(locale)
      : date.toLocaleDateString(locale);

  return <span suppressHydrationWarning>{formatted}</span>;
}

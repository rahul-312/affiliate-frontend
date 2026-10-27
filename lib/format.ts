const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso: string | null | undefined) => (iso ? date.format(new Date(iso)) : '—');

/** "closed_with_failures" → "Closed with failures" */
export const humanize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

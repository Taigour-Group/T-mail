// Gmail-style verified tick. Shown next to a workspace sender the TGO team has
// verified (e.g. support@acme.com). Purely a trust signal — it carries no action.
export default function VerifiedBadge({ className = 'h-4 w-4' }) {
  return (
    <svg
      className={`shrink-0 text-[#1a73e8] ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="Verified sender"
    >
      <title>Verified sender</title>
      <path d="m12 1 2.6 1.9 3.2-.2 1 3 2.6 1.8-1 3 1 3-2.6 1.8-1 3-3.2-.2L12 23l-2.6-1.9-3.2.2-1-3L2.6 16.5l1-3-1-3 2.6-1.8 1-3 3.2.2L12 1Z" />
      <path d="m8.5 12 2.3 2.3 4.7-4.7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useResource } from '@/hooks/useResource';
import { MemberNav } from '@/components/layout/Layout';
import { PageTitle, ResourceState, Action, Status, date } from '@/components/common/UI';
import { send } from '@/services/api';
import type { Loan, Notice, Reservation, User } from '@/types/api';
export function MyLibraryPage() {
  const { user } = useAuth();
  const profile = useResource<User>('/auth/me');
  const notices = useResource<Notice[]>('/notifications/me');
  return (
    <>
      <PageTitle title="My Library" eyebrow={`WELCOME, ${user?.firstName ?? 'READER'}`} />
      <MemberNav />
      <div className="quick-links">
        <Link className="panel" to="/my-library/reservations">
          <h2>Active reservations →</h2>
          <p>See what is ready to collect.</p>
        </Link>
        <Link className="panel" to="/my-library/loans">
          <h2>Borrowed books →</h2>
          <p>Check your books and due dates.</p>
        </Link>
        <Link className="panel" to="/my-library/history">
          <h2>Borrowing history →</h2>
          <p>Revisit your previous reads.</p>
        </Link>
      </div>
      <section className="panel">
        <h2>Your profile</h2>
        <ResourceState resource={profile} />
        {profile.data && (
          <>
            <p>
              {profile.data.firstName} {profile.data.lastName} · {profile.data.email}
            </p>
            <p>
              <Status value={profile.data.role} />
            </p>
            {profile.data.memberships.map((m) => (
              <p key={m.library.id}>
                {m.library.name} · {m.membershipNumber} <Status value={m.status} />
              </p>
            ))}
            {!profile.data.memberships.length && (
              <p>A demo library membership is created when you first reserve or borrow a book.</p>
            )}
          </>
        )}
      </section>
      <section className="section">
        <h2>Collection updates</h2>
        <ResourceState resource={notices} />
        {notices.data?.map((n) => (
          <article key={n.id} className="panel">
            <h3>{n.title}</h3>
            <p>{n.message}</p>
            <small>{date(n.createdAt)}</small>
          </article>
        ))}
        {notices.data?.length === 0 && <p>No updates yet.</p>}
      </section>
    </>
  );
}
export function MemberReservationsPage() {
  const reservations = useResource<Reservation[]>('/reservations/me');
  return (
    <>
      <PageTitle title="Your reservations" />
      <MemberNav />
      <ResourceState resource={reservations} />
      <div className="stack">
        {reservations.data?.map((r) => (
          <article className="panel record" key={r.id}>
            <div>
              <Status value={r.status} />
              <h2>
                <Link to={`/books/${r.bookId}`}>{r.book.title}</Link>
              </h2>
              <p>
                {r.pickupBranch.name} · {r.copy.barcode}
              </p>
              <p>
                {r.status === 'READY'
                  ? `Collect by ${date(r.expiresAt)}`
                  : 'The branch is preparing your book. Please wait until it is ready.'}
              </p>
            </div>
            <Action
              run={() => send(`/reservations/${r.id}`, 'DELETE')}
              onDone={reservations.reload}
            >
              Cancel reservation
            </Action>
          </article>
        ))}
      </div>
      {reservations.data?.length === 0 && (
        <p className="empty">
          No active reservations. <Link to="/search">Find your next book.</Link>
        </p>
      )}
    </>
  );
}
export function MemberLoansPage({ history = false }: { history?: boolean }) {
  const loans = useResource<Loan[]>(history ? '/loans/history' : '/loans/me');
  return (
    <>
      <PageTitle title={history ? 'Borrowing history' : 'Your borrowed books'} />
      <MemberNav />
      <ResourceState resource={loans} />
      <div className="stack">
        {loans.data?.map((loan) => (
          <article className="panel record" key={loan.id}>
            <div>
              <Status value={loan.status} />
              <h2>
                <Link to={`/books/${loan.copy.bookId}`}>{loan.copy.book.title}</Link>
              </h2>
              <p>
                {loan.branch.name} · {loan.copy.barcode}
              </p>
              <p>Borrowed {date(loan.borrowedAt)}</p>
            </div>
            <strong
              className={!history && new Date(loan.dueAt) < new Date() ? 'due overdue' : 'due'}
            >
              {history ? `Returned ${date(loan.returnedAt)}` : `Due ${date(loan.dueAt)}`}
            </strong>
          </article>
        ))}
      </div>
      {loans.data?.length === 0 && (
        <p className="empty">
          {history ? 'Your returned books will appear here.' : 'You have no active loans.'}
        </p>
      )}
    </>
  );
}

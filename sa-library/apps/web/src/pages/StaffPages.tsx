import { useState } from 'react';
import { useResource } from '@/hooks/useResource';
import { StaffNav } from '@/components/layout/Layout';
import { PageTitle, ResourceState, Action, Status, date, DataForm } from '@/components/common/UI';
import { send } from '@/services/api';
import type { Dashboard, Loan, Reservation, User } from '@/types/api';
export function StaffDashboardPage() {
  const dashboard = useResource<Dashboard>('/staff/dashboard');
  const labels = {
    totalCopies: 'Total book copies',
    availableCopies: 'Available copies',
    borrowedCopies: 'Borrowed copies',
    activeReservations: 'Active reservations',
    readyForCollection: 'Ready for collection',
    overdueLoans: 'Overdue loans',
  } as const;
  return (
    <>
      <PageTitle title="Branch workspace" eyebrow="STAFF DESK" />
      <StaffNav />
      <ResourceState resource={dashboard} />
      {dashboard.data && (
        <>
          <div className="stats-grid">
            {Object.entries(labels).map(([key, label]) => (
              <article key={key} className="panel stat">
                <p>{label}</p>
                <strong>{dashboard.data![key as keyof typeof labels]}</strong>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>Your branches</h2>
            {dashboard.data.branches.map((branch) => (
              <div key={branch.id}>
                <h3>{branch.name}</h3>
                <p>
                  {branch.address}, {branch.city}
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
export function StaffReservationsPage() {
  const reservations = useResource<Reservation[]>('/staff/reservations');
  return (
    <>
      <PageTitle title="Reservations" eyebrow="STAFF DESK" />
      <StaffNav />
      <ResourceState resource={reservations} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Book / barcode</th>
              <th>Reserved</th>
              <th>Status</th>
              <th>Pickup branch</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.data?.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.user.firstName} {r.user.lastName}
                  <small>{r.user.email}</small>
                </td>
                <td>
                  {r.book.title}
                  <small>{r.copy.barcode}</small>
                </td>
                <td>{date(r.reservedAt)}</td>
                <td>
                  <Status value={r.status} />
                  {r.expiresAt && <small>Collect by {date(r.expiresAt)}</small>}
                </td>
                <td>{r.pickupBranch.name}</td>
                <td className="table-actions">
                  {r.status === 'ACTIVE' && (
                    <Action
                      run={() => send(`/staff/reservations/${r.id}/ready`, 'PATCH')}
                      onDone={reservations.reload}
                    >
                      Mark ready
                    </Action>
                  )}
                  {r.status === 'READY' && (
                    <Action
                      run={() =>
                        send('/staff/loans/checkout', 'POST', {
                          userId: r.userId,
                          copyId: r.copyId,
                        })
                      }
                      onDone={reservations.reload}
                    >
                      Checkout
                    </Action>
                  )}
                  <Action
                    run={() => send(`/reservations/${r.id}`, 'DELETE')}
                    onDone={reservations.reload}
                  >
                    Cancel
                  </Action>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reservations.data?.length === 0 && (
        <p className="empty">No active reservations at your branches.</p>
      )}
    </>
  );
}
export function StaffLoansPage() {
  const [overdue, setOverdue] = useState(false);
  const loans = useResource<Loan[]>(`/staff/loans?overdue=${overdue}`);
  return (
    <>
      <PageTitle title="Loans & returns" eyebrow="STAFF DESK" />
      <StaffNav />
      <section className="panel">
        <h2>Check out a book</h2>
        <p>
          Enter a member email or membership number and the copy barcode. Reserved copies must first
          be marked ready.
        </p>
        <DataForm
          fields={[
            { name: 'member', label: 'Member email or membership number', required: true },
            { name: 'barcode', label: 'Book barcode', required: true },
          ]}
          label="Check out book"
          submit={(data) => send('/staff/loans/checkout', 'POST', data)}
          onDone={loans.reload}
          reset
        />
      </section>
      <div className="section-header">
        <h2>{overdue ? 'Overdue loans' : 'Active loans'}</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(event) => setOverdue(event.target.checked)}
          />
          Overdue only
        </label>
      </div>
      <ResourceState resource={loans} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Book / barcode</th>
              <th>Borrowed</th>
              <th>Due</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loans.data?.map((loan) => (
              <tr key={loan.id}>
                <td>
                  {loan.user.firstName} {loan.user.lastName}
                  <small>{loan.user.email}</small>
                </td>
                <td>
                  {loan.copy.book.title}
                  <small>
                    {loan.copy.barcode} · {loan.branch.name}
                  </small>
                </td>
                <td>{date(loan.borrowedAt)}</td>
                <td className={loan.status === 'OVERDUE' ? 'overdue' : ''}>{date(loan.dueAt)}</td>
                <td>
                  <Status value={loan.status} />
                </td>
                <td>
                  <Action
                    run={() => send('/staff/loans/return', 'POST', { copyId: loan.copy.id })}
                    onDone={loans.reload}
                  >
                    Return
                  </Action>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loans.data?.length === 0 && (
        <p className="empty">No {overdue ? 'overdue' : 'active'} loans.</p>
      )}
    </>
  );
}
export function StaffMembersPage() {
  const [query, setQuery] = useState('');
  const members = useResource<User[]>(`/staff/members?q=${encodeURIComponent(query)}`);
  return (
    <>
      <PageTitle title="Members" eyebrow="STAFF DESK" />
      <StaffNav />
      <form
        className="search-bar catalogue-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(String(new FormData(e.currentTarget).get('q') ?? ''));
        }}
      >
        <label className="sr-only" htmlFor="member-query">
          Find a member
        </label>
        <input id="member-query" name="q" placeholder="Name, exact email, or membership number" />
        <button className="button">Find member</button>
      </form>
      <p>Search a new member by their exact email. Existing library members are shown below.</p>
      <ResourceState resource={members} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Membership</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {members.data?.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.firstName} {member.lastName}
                </td>
                <td>{member.email}</td>
                <td>
                  {member.memberships.map((m) => (
                    <div key={m.library.id}>
                      {m.membershipNumber}
                      <small>{m.library.name}</small>
                    </div>
                  ))}
                </td>
                <td>
                  <Status value={member.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.data?.length === 0 && <p className="empty">No matching members.</p>}
    </>
  );
}

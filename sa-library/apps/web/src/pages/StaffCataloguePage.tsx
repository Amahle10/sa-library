import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '@/hooks/useResource';
import { StaffNav } from '@/components/layout/Layout';
import { PageTitle, ResourceState, Status, DataForm, compact } from '@/components/common/UI';
import { send } from '@/services/api';
import type { Book, Copy, Dashboard } from '@/types/api';
export function StaffCataloguePage() {
  const dashboard = useResource<Dashboard>('/staff/dashboard');
  const books = useResource<Book[]>('/books');
  const [branch, setBranch] = useState('');
  const selectedBranch = branch || dashboard.data?.branches[0]?.id || '';
  const copies = useResource<Copy[]>(selectedBranch ? `/branches/${selectedBranch}/copies` : null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Copy | null>(null);
  const visible = copies.data?.filter((c) =>
    `${c.book.title} ${c.barcode} ${c.book.isbn13 ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle title="Catalogue & inventory" eyebrow="STAFF DESK" />
      <StaffNav />
      <ResourceState resource={dashboard} />
      <ResourceState resource={books} />
      <div className="split-forms">
        <details className="panel">
          <summary>Add a book</summary>
          <DataForm
            label="Add book"
            fields={[
              { name: 'title', label: 'Title', required: true },
              { name: 'authors', label: 'Authors (comma separated)', required: true },
              { name: 'isbn13', label: 'ISBN-13', minLength: 13, maxLength: 13 },
              { name: 'publisher', label: 'Publisher' },
              { name: 'publishedYear', label: 'Publication year', type: 'number' },
              { name: 'category', label: 'Category' },
              { name: 'language', label: 'Language', initial: 'English', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
            ]}
            submit={(data) =>
              send('/books', 'POST', {
                ...compact(data),
                authors: data.authors
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                ...(data.publishedYear ? { publishedYear: Number(data.publishedYear) } : {}),
              })
            }
            onDone={books.reload}
            reset
          />
        </details>
        <details className="panel">
          <summary>Add a physical copy</summary>
          <DataForm
            key={books.data?.length}
            label="Add copy"
            fields={[
              {
                name: 'bookId',
                label: 'Book',
                type: 'select',
                required: true,
                options: books.data?.map((b) => ({ value: b.id, label: b.title })),
              },
              {
                name: 'branchId',
                label: 'Branch',
                type: 'select',
                required: true,
                options: dashboard.data?.branches.map((b) => ({ value: b.id, label: b.name })),
              },
              { name: 'barcode', label: 'Unique barcode', required: true },
              { name: 'shelfLocation', label: 'Shelf location' },
              { name: 'condition', label: 'Condition', initial: 'Good' },
            ]}
            submit={(data) => {
              const { bookId, ...copy } = data;
              return send(`/books/${bookId}/copies`, 'POST', compact(copy));
            }}
            onDone={copies.reload}
            reset
          />
        </details>
      </div>
      <div className="filters">
        <label>
          Branch
          <select
            value={selectedBranch}
            onChange={(e) => {
              setBranch(e.target.value);
              setEditing(null);
            }}
          >
            {dashboard.data?.branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search inventory
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, ISBN or barcode"
          />
        </label>
      </div>
      <ResourceState resource={copies} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>Barcode</th>
              <th>Branch</th>
              <th>Shelf / condition</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible?.map((copy) => (
              <tr key={copy.id}>
                <td>
                  <Link to={`/books/${copy.bookId}`}>{copy.book.title}</Link>
                </td>
                <td>{copy.barcode}</td>
                <td>{copy.branch.name}</td>
                <td>
                  {copy.shelfLocation}
                  <small>{copy.condition}</small>
                </td>
                <td>
                  <Status value={copy.status} />
                </td>
                <td>
                  <button className="button secondary small" onClick={() => setEditing(copy)}>
                    Edit copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible?.length === 0 && <p className="empty">No copies match this selection.</p>}
      {editing && (
        <div className="modal-backdrop">
          <section
            className="panel modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-copy-heading"
          >
            <div className="section-header">
              <h2 id="edit-copy-heading">Edit {editing.barcode}</h2>
              <button className="button secondary small" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <DataForm
              key={editing.id}
              label="Save copy"
              fields={[
                { name: 'barcode', label: 'Barcode', initial: editing.barcode, required: true },
                { name: 'shelfLocation', label: 'Shelf location', initial: editing.shelfLocation },
                { name: 'condition', label: 'Condition', initial: editing.condition },
                ...(['AVAILABLE', 'LOST', 'DAMAGED'].includes(editing.status)
                  ? [
                      {
                        name: 'status',
                        label: 'Status',
                        type: 'select' as const,
                        initial: editing.status,
                        required: true,
                        options: ['AVAILABLE', 'LOST', 'DAMAGED'].map((s) => ({
                          value: s,
                          label: s,
                        })),
                      },
                    ]
                  : []),
              ]}
              submit={(data) => send(`/copies/${editing.id}`, 'PATCH', data)}
              onDone={() => {
                setEditing(null);
                copies.reload();
              }}
            />
          </section>
        </div>
      )}
    </>
  );
}

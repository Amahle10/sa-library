import { Link, useNavigate, useParams } from 'react-router-dom';
import { useResource } from '@/hooks/useResource';
import { useAuth } from '@/features/auth/AuthProvider';
import { BookCover } from '@/components/common/BookCard';
import { Action, ResourceState } from '@/components/common/UI';
import { send } from '@/services/api';
import type { Book } from '@/types/api';
export function BookDetailPage() {
  const { id } = useParams();
  const book = useResource<Book>(`/books/${id}`);
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <Link className="back-link" to="/search">
        ← Back to catalogue
      </Link>
      <ResourceState resource={book} />
      {book.data && (
        <>
          <section className="book-detail">
            <BookCover book={book.data} />
            <div>
              <p className="eyebrow">{book.data.category}</p>
              <h1>{book.data.title}</h1>
              <p className="lead">{book.data.authors.join(', ')}</p>
              <p>{book.data.description}</p>
              <dl className="metadata">
                <div>
                  <dt>ISBN</dt>
                  <dd>{book.data.isbn13 || book.data.isbn10 || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Publisher</dt>
                  <dd>
                    {book.data.publisher || 'Not recorded'} {book.data.publishedYear}
                  </dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{book.data.language}</dd>
                </div>
              </dl>
            </div>
          </section>
          <section className="section">
            <h2>Choose your pickup branch</h2>
            <p>
              Reserve a physical copy and wait for the branch to mark it ready before collecting.
            </p>
            <div className="availability-list">
              {book.data.availability.map((branch) => (
                <article className="availability-row" key={branch.branchId}>
                  <div>
                    <h3>{branch.branchName}</h3>
                    <p>
                      {branch.availableCopies} available / {branch.totalCopies} copies
                    </p>
                    <small>
                      {branch.reservedCopies} reserved · {branch.borrowedCopies} borrowed
                      {branch.unavailableCopies > 0
                        ? ` · ${branch.unavailableCopies} unavailable`
                        : ''}
                    </small>
                  </div>
                  {branch.availableCopies ? (
                    user ? (
                      <Action
                        className="button"
                        run={() =>
                          send('/reservations', 'POST', {
                            bookId: id,
                            pickupBranchId: branch.branchId,
                          })
                        }
                        onDone={() => navigate('/my-library/reservations')}
                      >
                        Reserve at {branch.branchName}
                      </Action>
                    ) : (
                      <Link className="button" to="/login" state={{ from: `/books/${id}` }}>
                        Sign in to reserve
                      </Link>
                    )
                  ) : (
                    <button className="button secondary" disabled>
                      Unavailable
                    </button>
                  )}
                </article>
              ))}
            </div>
            {!book.data.availability.length && (
              <p className="empty">No physical copies have been added yet.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}

import { Link } from 'react-router-dom';
import type { Book } from '@/types/api';
export function BookCover({ book }: { book: Book }) {
  const tone = [...book.title].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
  return (
    <div className={`book-cover tone-${tone}`}>
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span className="cover-label">SA LIBRARY · READING COLLECTION</span>
      <strong>{book.title}</strong>
      <span>{book.authors?.join(' & ')}</span>
      <span className="cover-rule" />
    </div>
  );
}
export function BookCard({ book }: { book: Book }) {
  return (
    <article className="book-card">
      <Link to={`/books/${book.id}`} tabIndex={-1} aria-hidden="true">
        <BookCover book={book} />
      </Link>
      <div className="book-info">
        <p className="eyebrow">{book.category ?? 'General'}</p>
        <h3>
          <Link to={`/books/${book.id}`}>{book.title}</Link>
        </h3>
        <p>{book.authors.join(', ')}</p>
        {(book.isbn13 || book.isbn10) && <small>ISBN {book.isbn13 || book.isbn10}</small>}
        <p className="availability">
          {book.availableCopies} copies available ·{' '}
          {book.availability.filter((a) => a.availableCopies > 0).length} branches
        </p>
        <Link className="text-link" to={`/books/${book.id}`}>
          View book <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}

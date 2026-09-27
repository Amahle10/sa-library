import { useSearchParams } from 'react-router-dom';
import { useResource } from '@/hooks/useResource';
import { BookCard } from '@/components/common/BookCard';
import { PageTitle, ResourceState } from '@/components/common/UI';
import type { Book } from '@/types/api';
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const books = useResource<Book[]>(`/books?q=${encodeURIComponent(q)}`);
  return (
    <>
      <PageTitle title="Find your next read" eyebrow="THE COMMUNITY CATALOGUE" />
      <form
        className="search-bar catalogue-search"
        onSubmit={(event) => {
          event.preventDefault();
          setParams({ q: String(new FormData(event.currentTarget).get('q') ?? '') });
        }}
      >
        <label className="sr-only" htmlFor="catalogue-query">
          Search by title, author or ISBN
        </label>
        <input
          key={q}
          id="catalogue-query"
          name="q"
          defaultValue={q}
          placeholder="Title, author or ISBN"
        />
        <button className="button">Search</button>
      </form>
      <ResourceState resource={books} />
      {books.data && (
        <>
          <p className="result-count">
            {books.data.length} books {q ? `matching “${q}”` : 'to explore'}
          </p>
          <div className="book-grid">
            {books.data.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          {!books.data.length && (
            <p className="empty">No books found. Try another title, author or ISBN.</p>
          )}
        </>
      )}
    </>
  );
}

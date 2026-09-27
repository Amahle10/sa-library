import { Link, useNavigate } from 'react-router-dom';
import { useResource } from '@/hooks/useResource';
import { BookCard } from '@/components/common/BookCard';
import { ResourceState } from '@/components/common/UI';
import type { Book, Library } from '@/types/api';
export function HomePage() {
  const books = useResource<Book[]>('/books');
  const libraries = useResource<Library[]>('/libraries');
  const navigate = useNavigate();
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">YOUR COMMUNITY. YOUR NEXT CHAPTER.</p>
          <h1>
            Good books.
            <br />
            Closer to <em>home.</em>
          </h1>
          <p className="hero-copy">
            Discover books across your local public libraries. Find a copy, reserve it online, and
            collect it from your branch.
          </p>
          <form
            className="search-bar"
            onSubmit={(event) => {
              event.preventDefault();
              const q = new FormData(event.currentTarget).get('q');
              navigate(`/search?q=${encodeURIComponent(String(q ?? ''))}`);
            }}
          >
            <label className="sr-only" htmlFor="home-search">
              Search books
            </label>
            <input id="home-search" name="q" placeholder="Search by title, author or ISBN" />
            <button className="button">
              Find a book <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="hero-facts">
            <span>
              01 <b>Discover</b>
            </span>
            <span>
              02 <b>Reserve</b>
            </span>
            <span>
              03 <b>Collect & read</b>
            </span>
          </div>
        </div>
        <aside className="hero-art" aria-label="Your next chapter starts at your library">
          <div className="orbit" />
          <div className="hero-book book-one">
            A little curiosity.
            <br />
            <strong>
              A whole
              <br />
              new world.
            </strong>
            <span>YOUR PUBLIC LIBRARY</span>
          </div>
          <div className="hero-book book-two">
            STORIES
            <br />
            BELONG
            <br />
            TO EVERYONE.
          </div>
          <span className="art-caption">Open a book. Open a possibility.</span>
        </aside>
      </section>
      <section className="section">
        <header className="section-header">
          <div>
            <p className="eyebrow">SOMETHING FOR EVERY READER</p>
            <h2>Explore the shelves</h2>
          </div>
          <Link className="text-link" to="/search">
            Browse all books →
          </Link>
        </header>
        <ResourceState resource={books} />
        <div className="book-grid">
          {books.data?.slice(0, 6).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>
      <section className="libraries-section">
        <header className="section-header">
          <div>
            <p className="eyebrow">ROOTED IN YOUR COMMUNITY</p>
            <h2>Meet your local libraries</h2>
          </div>
          <span className="demo-label">Demonstration branches</span>
        </header>
        <ResourceState resource={libraries} />
        {libraries.data?.map((library) => (
          <div key={library.id}>
            <h3>{library.name}</h3>
            <div className="branch-grid">
              {library.branches.map((branch) => (
                <article key={branch.id} className="branch-card">
                  <span aria-hidden="true">⌂</span>
                  <h3>{branch.name}</h3>
                  <p>
                    {branch.city}, {branch.province}
                  </p>
                  <Link to="/search">Explore the catalogue →</Link>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

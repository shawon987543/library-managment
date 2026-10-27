'use client';
import { useCallback, useEffect, useState } from 'react';
import BorrowReturnSection from '../components/BorrowReturnSection';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import Link from 'next/link';

interface Book {
  id: number;
  title: string;
  autor: string;
  isbn: string;
  available: boolean;
  genre: string;
  createdAt?: string;
}

interface FavoriteRecord {
  id?: number;
  book?: Book;
}

type SortOrder = 'ASC' | 'DESC';

export default function HomePage() {
  const router = useRouter();

  const [selectedGenre, setSelectedGenre] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  const [authenticated, setAuthenticated] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [userId, setUserId] = useState<number | null>(null);

  const genres = [
    'Programming',
    'Technology',
    'Science',
    'Fiction',
    'Fantasy',
    'History',
    'Education',
    'Mystery',
    'Biography',
    'Business',
    'Other',
  ];

  // Search by title, author, or ISBN; filter by genre; sort by creation date.
  const filteredBooks = books
    .filter((book) => {
      const query = searchTerm.trim().toLowerCase();

      const matchesSearch =
        (book.title || '').toLowerCase().includes(query) ||
        (book.autor || '').toLowerCase().includes(query) ||
        (book.isbn || '').toLowerCase().includes(query);

      const matchesGenre =
        selectedGenre === 'All' ||
        (book.genre || 'Other').toLowerCase() ===
          selectedGenre.toLowerCase();

      return matchesSearch && matchesGenre;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
    });

  // Read the logged-in user's ID from the access token.
  useEffect(() => {
    const token = sessionStorage.getItem('access_token');

    if (token) {
      try {
        const payload = JSON.parse(
          atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        );

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserId(Number(payload.sub));
      } catch (error) {
        console.error('Could not read user ID from token:', error);
      }
    }
  }, []);

  // Check authentication before loading dashboard data.
  useEffect(() => {
    const token = sessionStorage.getItem('access_token');

    if (!token) {
      router.replace('/login');
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthenticated(true);
  }, [router]);

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    router.replace('/login');
  }, [router]);

  // Fetch books from the backend.
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<Book[]>('/books');
      setBooks(response.data);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      setError('Could not load books. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  // Load this user's saved favorites.
  const fetchFavorites = useCallback(async () => {
    try {
      const response = await api.get<
        | Book[]
        | FavoriteRecord[]
        | {
            favorites?: Book[] | FavoriteRecord[];
            favoriteBooks?: Book[];
          }
      >('/users/me/favorites');

      const data = response.data;

      const records = Array.isArray(data)
        ? data
        : data.favorites ?? data.favoriteBooks ?? [];

      const ids = records
        .map((item) => {
          if ('book' in item && item.book) {
            return item.book.id;
          }

          return item.id;
        })
        .filter((id): id is number => typeof id === 'number');

      setFavoriteIds([...new Set(ids)]);
      setFavoriteMessage('');
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      setFavoriteMessage(
        'Could not load favorites. Please check the favorites API.',
      );
    }
  }, [handleUnauthorized]);

  // Load books and favorites after authentication.
  useEffect(() => {
    if (authenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchBooks();
      void fetchFavorites();
    }
  }, [authenticated, fetchBooks, fetchFavorites]);

  // Add or remove a book from favorites.
  const toggleFavorite = async (bookId: number) => {
    if (favoriteLoadingIds.includes(bookId)) {
      return;
    }

    const isFavorite = favoriteIds.includes(bookId);

    setFavoriteLoadingIds((previous) => [...previous, bookId]);
    setFavoriteMessage('');

    try {
      if (isFavorite) {
        await api.delete(`/users/me/favorites/${bookId}`);

        setFavoriteIds((previous) =>
          previous.filter((id) => id !== bookId),
        );

        setFavoriteMessage('Book removed from your favorites.');
      } else {
        await api.post(`/users/me/favorites/${bookId}`);

        setFavoriteIds((previous) =>
          previous.includes(bookId) ? previous : [...previous, bookId],
        );

        setFavoriteMessage('Book added to your favorites.');
      }
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      setFavoriteMessage(
        isFavorite
          ? 'Could not remove this book from favorites.'
          : 'Could not add this book to favorites.',
      );
    } finally {
      setFavoriteLoadingIds((previous) =>
        previous.filter((id) => id !== bookId),
      );
    }
  };

  // Reset search, genre, and sorting.
  function resetFilters() {
    setSearchTerm('');
    setSelectedGenre('All');
    setSortOrder('DESC');
  }

  // Logout the current user.
  function handleLogout() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    router.replace('/login');
  }

  // Avoid showing the dashboard before checking authentication.
  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">Checking authentication...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="dashboard-hero mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 sm:p-8">
          <div className="dashboard-brand">
            <div className="dashboard-brand-mark" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
                <path d="M4 5.5v16M8 7h8M8 11h8" />
              </svg>
            </div>

            <div>
              <p className="dashboard-eyebrow">Library workspace</p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Library Management
              </h1>
              <p className="mt-2">
                Your collection, borrowing, and returns—all in one place.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="dashboard-primary-action inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold text-white"
            >
              Dashboard
            </Link>

            {userId !== null && Number.isFinite(userId) && (
              <Link
                href={`/users/${userId}`}
                className="dashboard-primary-action inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold text-white"
              >
                Profile
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="dashboard-secondary-action rounded-lg border px-5 py-3 font-semibold"
            >
              Logout
            </button>
          </nav>
        </header>

        {/* Book loading error */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-100 p-4 text-red-800"
          >
            {error}
          </div>
        )}

        {/* Favorites feedback */}
        {favoriteMessage && (
          <div
            role="status"
            className={`mb-5 rounded-lg p-4 ${
              favoriteMessage.startsWith('Book ')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {favoriteMessage}
          </div>
        )}

        {/* Books collection */}
        <section className="dashboard-panel rounded-2xl p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="dashboard-eyebrow">Your library</p>
              <h2 className="text-xl font-bold">Books Collection</h2>
              <p className="mt-1 text-sm text-gray-500">
                Search, filter, and sort books, save favorites, or select a
                title to see its details.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                {filteredBooks.length}{' '}
                {filteredBooks.length === 1 ? 'book' : 'books'}
              </span>

              <button
                type="button"
                onClick={() => {
                  void fetchBooks();
                  void fetchFavorites();
                }}
                disabled={loading}
                className="dashboard-secondary-action rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Search, genre filter, and sorting */}
          <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex min-w-56 flex-1 flex-col gap-2">
              <label
                htmlFor="book-search"
                className="font-semibold text-gray-700"
              >
                Search books
              </label>
              <input
                id="book-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Title, author, or ISBN..."
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex min-w-44 flex-col gap-2">
              <label
                htmlFor="user-genre-filter"
                className="font-semibold text-gray-700"
              >
                Filter by genre
              </label>
              <select
                id="user-genre-filter"
                value={selectedGenre}
                onChange={(event) => setSelectedGenre(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-800"
              >
                <option value="All">All Genres</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-48 flex-col gap-2">
              <label
                htmlFor="book-sort"
                className="font-semibold text-gray-700"
              >
                Sort by date added
              </label>
              <select
                id="book-sort"
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value as SortOrder)
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-800"
              >
                <option value="DESC">Newest first</option>
                <option value="ASC">Oldest first</option>
              </select>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="dashboard-secondary-action rounded-lg border px-4 py-2.5 font-semibold"
            >
              Reset filters
            </button>

            <p className="w-full text-sm text-gray-500">
              Showing {filteredBooks.length} of {books.length} books
            </p>
          </div>

          {loading ? (
            <p className="py-10 text-center text-gray-600">
              Loading books...
            </p>
          ) : books.length === 0 ? (
            <div className="dashboard-empty-state px-6 py-12 text-center">
              <p className="font-semibold text-gray-700">
                No books available
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Please check again later.
              </p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="dashboard-empty-state px-6 py-12 text-center">
              <p className="font-semibold text-gray-700">
                No books match your search or selected genre.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Try another keyword or reset your filters.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="dashboard-primary-action mt-4 rounded-lg px-4 py-2 font-semibold text-white"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-225 border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      ID
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Title
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Author
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Genre
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      ISBN
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Favorite
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBooks.map((book) => {
                    const isFavorite = favoriteIds.includes(book.id);
                    const isSaving = favoriteLoadingIds.includes(book.id);

                    return (
                      <tr
                        key={book.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-4 text-gray-700">
                          {book.id}
                        </td>

                        <td className="px-4 py-4 font-medium">
                          <Link
                            href={`/books/${book.id}`}
                            className="dashboard-book-link"
                          >
                            {book.title}
                          </Link>
                        </td>

                        <td className="px-4 py-4 text-gray-700">
                          {book.autor}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800">
                            {book.genre || 'Other'}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-gray-700">
                          {book.isbn}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              book.available
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {book.available ? 'Available' : 'Borrowed'}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => void toggleFavorite(book.id)}
                            disabled={isSaving}
                            aria-pressed={isFavorite}
                            aria-label={
                              isFavorite
                                ? `Remove ${book.title} from favorites`
                                : `Add ${book.title} to favorites`
                            }
                            className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              isFavorite
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            {isSaving
                              ? 'Saving...'
                              : isFavorite
                                ? '♥ Remove Favorite'
                                : '♡ Add to Favorites'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Borrow and Return functionality */}
          <div className="mt-8 border-t border-gray-200 pt-6">
            <BorrowReturnSection />
          </div>
        </section>
      </div>
    </main>
  );
}

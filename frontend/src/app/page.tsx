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
}

interface FavoriteRecord {
  id?: number;
  book?: Book;
}

export default function HomePage() {
  const router = useRouter();

  const [authenticated, setAuthenticated] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favoriteMessage, setFavoriteMessage] = useState('');

  // Check authentication before loading dashboard data.
  useEffect(() => {
    const token = sessionStorage.getItem('access_token');

    if (!token) {
      router.replace('/login');
      return;
    }

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
        Book[] | FavoriteRecord[] | {
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
          // Explicit Favorite model: each record may contain a related book.
          if ('book' in item && item.book) {
            return item.book.id;
          }

          // If the endpoint returns Book objects directly.
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
        'Could not load favorites. Please check the favorites API.'
      );
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (authenticated) {
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
          previous.filter((id) => id !== bookId)
        );

        setFavoriteMessage('Book removed from your favorites.');
      } else {
        await api.post(`/users/me/favorites/${bookId}`);

        setFavoriteIds((previous) =>
          previous.includes(bookId) ? previous : [...previous, bookId]
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
          : 'Could not add this book to favorites.'
      );
    } finally {
      setFavoriteLoadingIds((previous) =>
        previous.filter((id) => id !== bookId)
      );
    }
  };

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

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-5 py-3 font-semibold text-white"
          >
            Logout
          </button>
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
                Browse books, save favorites, or select a title to see its details.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                {books.length} {books.length === 1 ? 'book' : 'books'}
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
                  {books.map((book) => {
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
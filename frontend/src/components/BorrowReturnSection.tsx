'use client';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import api from '../lib/api';

interface Book {
  id: number;
  title: string;
  autor: string;
  availableCopies: number;
  totalCopies: number;
  isActive: boolean;
}

interface Borrowing {
  id: number;
  userId: number;
  bookId: number;
  borrowedAt: string;
  returnedAt: string | null;
  user: {
    id: number;
    name: string;
    email: string;
  };
  book: {
    id: number;
    title: string;
    autor: string;
    isbn: string;
  };
}

interface TokenPayload {
  sub?: number | string;
  id?: number | string;
  userId?: number | string;
}

function getLoggedInUserId(): number | null {
  if (typeof window === 'undefined') return null;

  const token = sessionStorage.getItem('access_token');
  if (!token) return null;

  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const base64 = payloadPart
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const payload = JSON.parse(atob(base64)) as TokenPayload;
    const rawId = payload.sub ?? payload.id ?? payload.userId;

    if (rawId === undefined || rawId === null) return null;

    const id = Number(rawId);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export default function BorrowReturnSection() {
  const [records, setRecords] = useState<Borrowing[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setCurrentUserId(getLoggedInUserId());
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      // GET /borrowings should return all borrowing records.
      const response = await api.get<Borrowing[]>('/borrowings');
      setRecords(response.data);
    } catch {
      setError('Could not load borrowing history.');
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    try {
      const response = await api.get<Book[]>('/books');
      setBooks(response.data);
    } catch {
      setError('Could not load the book collection.');
    }
  }, []);

  useEffect(() => {
    void fetchRecords();
    void fetchBooks();
  }, [fetchRecords, fetchBooks]);

  async function handleBorrow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bookId) {
      setError('Please select a book.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/borrowings', {
        bookId: Number(bookId),
      });

      setSuccess('Book borrowed successfully!');
      setBookId('');

      await Promise.all([fetchRecords(), fetchBooks()]);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'response' in err
          ? (
              err as {
                response?: {
                  data?: { message?: string | string[] };
                };
              }
            ).response?.data?.message
          : undefined;

      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Could not borrow this book.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReturn(id: number) {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // The backend must also check that this record belongs to the user.
      await api.patch(`/borrowings/${id}/return`);

      setSuccess('Book returned successfully!');
      await Promise.all([fetchRecords(), fetchBooks()]);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'response' in err
          ? (
              err as {
                response?: {
                  data?: { message?: string | string[] };
                };
              }
            ).response?.data?.message
          : undefined;

      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Could not return this book.',
      );
    } finally {
      setLoading(false);
    }
  }

  const availableBooks = books.filter(
    (book) => book.isActive && book.availableCopies > 0,
  );

  return (
    <section className="dashboard-subpanel mt-10">
      <div className="mb-6">
        <p className="dashboard-eyebrow">Library activity</p>
        <h2 className="text-xl font-bold">Borrow &amp; Return</h2>
        <p className="mt-1 text-sm text-gray-500">
          Borrow available books and view borrowing history for all users.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-100 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 rounded-lg bg-green-100 p-3 text-green-800"
        >
          {success}
        </div>
      )}

      <form
        onSubmit={handleBorrow}
        className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <label className="text-sm font-semibold text-gray-700">
          Select a book
          <select
            required
            value={bookId}
            onChange={(event) => setBookId(event.target.value)}
            disabled={loading}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Choose an available book</option>
            {availableBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title} — {book.availableCopies} available
              </option>
            ))}
          </select>

          {availableBooks.length === 0 && (
            <span className="mt-1 block text-xs font-normal text-amber-700">
              No active books currently have available copies.
            </span>
          )}
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || !bookId}
            className="dashboard-primary-action w-full rounded-lg px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Borrow Book'}
          </button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">All Borrowing History</h3>
          <p className="mt-1 text-sm text-gray-500">
            All users' records are visible. You can return only your own
            unreturned books.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setError('');
            void Promise.all([fetchRecords(), fetchBooks()]);
          }}
          className="dashboard-secondary-action rounded-lg border px-4 py-2 text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3">Borrower</th>
              <th className="p-3">Book</th>
              <th className="p-3">Borrowed On</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => {
              const isMyRecord =
                currentUserId !== null &&
                Number(record.userId) === currentUserId;

              const canReturn =
                isMyRecord && record.returnedAt === null;

              return (
                <tr key={record.id} className="border-b border-gray-100">
                  <td className="p-3">
                    <p className="font-semibold text-gray-900">
                      {record.user?.name || 'Unknown user'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.user?.email || ''}
                    </p>
                  </td>

                  <td className="p-3">
                    <p className="font-medium text-gray-900">
                      {record.book?.title || 'Unknown book'}
                    </p>
                    <p className="text-xs text-gray-500">
                      By {record.book?.autor || 'Unknown author'}
                    </p>
                  </td>

                  <td className="p-3 text-gray-700">
                    {record.borrowedAt
                      ? new Date(record.borrowedAt).toLocaleDateString()
                      : '—'}
                  </td>

                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        record.returnedAt
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {record.returnedAt ? 'Returned' : 'Borrowed'}
                    </span>

                    {record.returnedAt && (
                      <p className="mt-1 text-xs text-gray-500">
                        Returned on{' '}
                        {new Date(record.returnedAt).toLocaleDateString()}
                      </p>
                    )}
                  </td>

                  <td className="p-3">
                    {canReturn ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleReturn(record.id)}
                        className="rounded-lg bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Return
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {record.returnedAt
                          ? 'Completed'
                          : isMyRecord
                            ? 'Your book'
                            : 'View only'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No borrowing history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

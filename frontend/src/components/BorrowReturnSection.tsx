
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
  dueDate: string | null;
  renewalCount: number;
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

interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
}

function getErrorMessage(
  err: unknown,
  fallback: string,
): string {
  const message = (err as ApiError)?.response?.data?.message;

  return Array.isArray(message)
    ? message.join(', ')
    : message || fallback;
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

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not set';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BorrowReturnSection() {
  const [records, setRecords] = useState<Borrowing[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setCurrentUserId(getLoggedInUserId());
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const response = await api.get<Borrowing[]>('/borrowings');
      setRecords(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load borrowing history.'));
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    try {
      const response = await api.get<Book[]>('/books');
      setBooks(response.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not load the book collection.'));
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
      setError(getErrorMessage(err, 'Could not borrow this book.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReturn(id: number) {
    setProcessingId(id);
    setError('');
    setSuccess('');

    try {
      await api.patch(`/borrowings/${id}/return`);

      setSuccess('Book returned successfully!');
      await Promise.all([fetchRecords(), fetchBooks()]);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not return this book.'));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRenew(id: number) {
    setProcessingId(id);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch<{
        message?: string;
        dueDate?: string;
        renewalCount?: number;
        renewalsRemaining?: number;
      }>(`/borrowings/${id}/renew`);

      setSuccess(
        response.data.message ||
          'Book renewed successfully! The due date has been extended.',
      );

      await fetchRecords();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not renew this book.'));
    } finally {
      setProcessingId(null);
    }
  }

  const availableBooks = books.filter(
    (book) => book.isActive && book.availableCopies > 0,
  );

  return (
    <section className="dashboard-subpanel mt-10">
      <div className="mb-6">
        <p className="dashboard-eyebrow">Library activity</p>
        <h2 className="text-xl font-bold">Borrow, Return &amp; Renew</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your borrowed books and review borrowing history.
          You can renew an eligible book up to two times.
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
          <h3 className="text-lg font-bold">Borrowing History</h3>
          <p className="mt-1 text-sm text-gray-500">
            Return and renew actions are available only for your own eligible records.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || processingId !== null}
          onClick={() => {
            setError('');
            void Promise.all([fetchRecords(), fetchBooks()]);
          }}
          className="dashboard-secondary-action rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-3">Borrower</th>
              <th className="p-3">Book</th>
              <th className="p-3">Borrowed On</th>
              <th className="p-3">Due Date</th>
              <th className="p-3">Renewals</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => {
              const isMyRecord =
                currentUserId !== null &&
                Number(record.userId) === currentUserId;

              const isReturned = record.returnedAt !== null;
              const renewals = record.renewalCount ?? 0;
              const dueDate = record.dueDate
                ? new Date(record.dueDate)
                : null;

              const isOverdue =
                !isReturned &&
                dueDate !== null &&
                !Number.isNaN(dueDate.getTime()) &&
                dueDate.getTime() <= Date.now();

              const canReturn = isMyRecord && !isReturned;

              const canRenew =
                isMyRecord &&
                !isReturned &&
                !isOverdue &&
                renewals < 2;

              const isProcessing = processingId === record.id;

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
                    {formatDate(record.borrowedAt)}
                  </td>

                  <td className="p-3">
                    <span
                      className={
                        isOverdue
                          ? 'font-semibold text-red-700'
                          : 'text-gray-700'
                      }
                    >
                      {formatDate(record.dueDate)}
                    </span>

                    {isOverdue && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        Overdue
                      </p>
                    )}
                  </td>

                  <td className="p-3">
                    <span className="font-semibold text-gray-800">
                      {renewals}/2
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      {Math.max(0, 2 - renewals)} remaining
                    </p>
                  </td>

                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        isReturned
                          ? 'bg-green-100 text-green-800'
                          : isOverdue
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isReturned
                        ? 'Returned'
                        : isOverdue
                          ? 'Overdue'
                          : 'Borrowed'}
                    </span>

                    {isReturned && (
                      <p className="mt-1 text-xs text-gray-500">
                        Returned {formatDate(record.returnedAt)}
                      </p>
                    )}
                  </td>

                  <td className="p-3">
                    {isMyRecord && !isReturned ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            isProcessing ||
                            processingId !== null ||
                            loading
                          }
                          onClick={() => void handleReturn(record.id)}
                          className="rounded-lg bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'Processing...' : 'Return'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            !canRenew ||
                            isProcessing ||
                            processingId !== null ||
                            loading
                          }
                          title={
                            isOverdue
                              ? 'Overdue books cannot be renewed'
                              : renewals >= 2
                                ? 'Maximum renewals reached'
                                : 'Extend the due date by 14 days'
                          }
                          onClick={() => void handleRenew(record.id)}
                          className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isProcessing ? 'Processing...' : 'Renew'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {isReturned
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
                <td colSpan={7} className="p-8 text-center text-gray-500">
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

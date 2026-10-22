'use client';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

type Role = 'USER' | 'ADMIN';

type Book = {
  id: number;
  title: string;
  autor: string;
  isbn: string;
  description: string | null;
  available: boolean;
  isActive: boolean;
};

type TokenPayload = {
  role: Role;
  exp?: number;
};

type BookForm = {
  title: string;
  autor: string;
  isbn: string;
  description: string;
};

const emptyForm: BookForm = {
  title: '',
  autor: '',
  isbn: '',
  description: '',
};

export default function AdminPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    router.replace('/login');
  }, [router]);

  const loadBooks = useCallback(async () => {
    const response = await api.get<Book[]>('/books');
    setBooks(response.data);
  }, []);

  // Check authentication and administrator role.
  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const token = sessionStorage.getItem('access_token');

        if (!token) {
          router.replace('/login');
          return;
        }

        const parts = token.split('.');

        if (parts.length !== 3) {
          handleUnauthorized();
          return;
        }

        const base64 = parts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        const payload = JSON.parse(
          atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
        ) as TokenPayload;

        if (
          typeof payload.exp !== 'number' ||
          payload.exp * 1000 <= Date.now()
        ) {
          handleUnauthorized();
          return;
        }

        if (payload.role !== 'ADMIN') {
          router.replace('/');
          return;
        }

        if (active) {
          setAuthorized(true);
        }

        await loadBooks();
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

        if (active) {
          setError('Could not load books. Please check your backend.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [router, loadBooks, handleUnauthorized]);

  // Add or update a book.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      autor: form.autor.trim(),
      isbn: form.isbn.trim(),
      description: form.description.trim(),
    };

    try {
      if (editingId !== null) {
        await api.put(`/books/${editingId}`, payload);
        setSuccess('Book updated successfully.');
      } else {
        await api.post('/books', payload);
        setSuccess('Book added successfully.');
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadBooks();
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err
      ) {
        const response = (
          err as {
            response?: {
              status?: number;
              data?: { message?: string | string[] };
            };
          }
        ).response;

        if (response?.status === 401) {
          handleUnauthorized();
          return;
        }

        const message = response?.data?.message;

        setError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Could not save the book.',
        );
      } else {
        setError('Could not connect to the server.');
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(book: Book) {
    setEditingId(book.id);
    setForm({
      title: book.title,
      autor: book.autor,
      isbn: book.isbn,
      description: book.description ?? '',
    });

    setError('');
    setSuccess('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setSuccess('');
  }

  // Activate or deactivate a book.
  async function toggleBookStatus(book: Book) {
    const nextActive = !book.isActive;

    setError('');
    setSuccess('');

    try {
      await api.patch(`/books/${book.id}/status`, {
        isActive: nextActive,
      });

      setSuccess(
        nextActive
          ? 'Book reactivated successfully.'
          : 'Book deactivated successfully.',
      );

      await loadBooks();
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err
      ) {
        const response = (
          err as {
            response?: {
              status?: number;
              data?: { message?: string | string[] };
            };
          }
        ).response;

        if (response?.status === 401) {
          handleUnauthorized();
          return;
        }

        const message = response?.data?.message;

        setError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Could not update book status.',
        );
      } else {
        setError('Could not connect to the server.');
      }
    }
  }

  // Delete a book.
  async function deleteBook(book: Book) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${book.title}"?`,
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    try {
      await api.delete(`/books/${book.id}`);

      setSuccess('Book deleted successfully.');

      if (editingId === book.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      await loadBooks();
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err
      ) {
        const response = (
          err as {
            response?: {
              status?: number;
              data?: { message?: string | string[] };
            };
          }
        ).response;

        if (response?.status === 401) {
          handleUnauthorized();
          return;
        }

        const message = response?.data?.message;

        setError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Could not delete the book.',
        );
      } else {
        setError('Could not connect to the server.');
      }
    }
  }

  function logout() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    router.replace('/login');
  }

  async function refreshBooks() {
    setError('');

    try {
      await loadBooks();
    } catch {
      setError('Could not refresh books. Please try again.');
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page flex min-h-screen items-center justify-center px-4">
        <p className="text-gray-600">
          Checking administrator access...
        </p>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  const availableCount = books.filter(
    (book) => book.isActive && book.available,
  ).length;

  const borrowedCount = books.filter(
    (book) => book.isActive && !book.available,
  ).length;

  const deactivatedCount = books.filter(
    (book) => !book.isActive,
  ).length;

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200';

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
              <p className="dashboard-eyebrow">
                Administrator workspace
              </p>

              <h1 className="text-2xl font-bold sm:text-3xl">
                Library Management
              </h1>

              <p className="mt-2">
                Manage books, descriptions, and availability.
              </p>

              <span className="mt-3 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                ADMINISTRATOR
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="dashboard-secondary-action rounded-lg  border px-5 py-3 font-black"
            >
              Main dashboard
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Messages */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-100 p-4 text-red-800"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-lg bg-green-100 p-4 text-green-800"
          >
            {success}
          </div>
        )}

        {/* Statistics: original three-column alignment */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total books" value={books.length} />

          <StatCard label="Available books" value={availableCount} />

          <StatCard
            label="Borrowed / unavailable"
            value={borrowedCount}
          />
        </section>

        {/* Add or edit a book */}
        <section className="dashboard-panel mb-8 rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <p className="dashboard-eyebrow">
              Collection management
            </p>

            <h2 className="text-xl font-bold">
              {editingId !== null ? 'Edit book details' : 'Add a book'}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Enter the book information below to update your catalog.
            </p>
          </div>

          {/* Original two-column form alignment */}
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="title"
                className="mb-2 block font-semibold text-gray-800"
              >
                Book title
              </label>

              <input
                id="title"
                required
                minLength={2}
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="Enter book title"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="autor"
                className="mb-2 block font-semibold text-gray-800"
              >
                Author
              </label>

              <input
                id="autor"
                required
                value={form.autor}
                onChange={(e) =>
                  setForm({ ...form, autor: e.target.value })
                }
                placeholder="Enter author name"
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="isbn"
                className="mb-2 block font-semibold text-gray-800"
              >
                ISBN
              </label>

              <input
                id="isbn"
                required
                value={form.isbn}
                onChange={(e) =>
                  setForm({ ...form, isbn: e.target.value })
                }
                placeholder="Enter ISBN"
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="description"
                className="mb-2 block font-semibold text-gray-800"
              >
                Book description
                <span className="ml-2 text-xs font-normal text-blue-600">
                  Admin only
                </span>
              </label>

              <textarea
                id="description"
                rows={5}
                maxLength={5000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Write a description about this book..."
                className={`${inputClass} resize-y`}
              />

              <p className="mt-1 text-right text-xs text-gray-500">
                {form.description.length}/5000 characters
              </p>
            </div>

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="dashboard-primary-action rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : editingId !== null
                    ? 'Save changes'
                    : 'Add book'}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="dashboard-secondary-action rounded-lg border px-6 py-3 font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Books collection */}
        <section className="dashboard-panel rounded-2xl p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="dashboard-eyebrow">Your library</p>

              <h2 className="text-xl font-bold">Books collection</h2>

              <p className="mt-1 text-sm text-gray-500">
                Manage book details and availability.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                {books.length} {books.length === 1 ? 'book' : 'books'}
              </span>

              <button
                type="button"
                onClick={() => void refreshBooks()}
                className="dashboard-secondary-action rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>
          </div>

          {books.length === 0 ? (
            <div className="dashboard-empty-state px-6 py-12 text-center">
              <p className="font-semibold text-gray-700">
                No books found
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Add your first book using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
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
                      Description
                    </th>

                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Status
                    </th>

                    <th className="px-4 py-3 font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {books.map((book) => (
                    <tr
                      key={book.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-4 text-gray-700">
                        {book.id}
                      </td>

                      <td className="px-4 py-4 font-medium text-gray-900">
                        {book.title}
                      </td>

                      <td className="px-4 py-4 text-gray-700">
                        {book.autor}
                      </td>

                      <td className="px-4 py-4 text-gray-700">
                        {book.isbn}
                      </td>

                      <td className="max-w-xs px-4 py-4">
                        <p className="whitespace-pre-wrap break-words text-gray-600">
                          {book.description?.trim() || 'No description'}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                            !book.isActive
                              ? 'bg-red-100 text-red-800'
                              : book.available
                                ? 'bg-green-100 text-green-800'
                                : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {!book.isActive
                            ? 'Deactivated'
                            : book.available
                              ? 'Available'
                              : 'Borrowed'}
                        </span>
                      </td>

                      {/* Original horizontal button alignment */}
                     <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-2">
                        <button
                            type="button"
                            onClick={() => startEdit(book)}
                            className="w-28 rounded-md bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-800 hover:bg-amber-200"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            onClick={() => void toggleBookStatus(book)}
                            className={`w-28 rounded-md px-3 py-2 text-center text-sm font-semibold ${
                                book.isActive
                                ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                        >
                        {book.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>

                     <button
                            type="button"
                            onClick={() => void deleteBook(book)}
                            className="w-28 rounded-md bg-red-100 px-3 py-2 text-center text-sm font-semibold text-red-800 hover:bg-red-200"
                    >
                        Delete
                    </button>
                    </div>
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="dashboard-panel rounded-2xl p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FavoriteButton from '../../../components/favoriteButton';
import Link from 'next/link';
import api from '../../../lib/api';
import { empty } from '../../../../../src/generated/prisma/internal/prismaNamespace';

interface Borrowing {
  id: number;
  borrowedAt: string;
  returnedAt: string | null;
  user: {
    id: number;
    name: string;
  };
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    name: string;
  };
}

interface Book {
  id: number;
  title: string;
  autor: string;
  isbn: string;
  description: string | null;
  totalCopies: number;
  availableCopies: number;
  available: boolean;
  isActive: boolean;
  createdAt: string;
  borrowings: Borrowing[];
  reviews: Review[];
}

interface BookForm{
  title: string;
  autor: string;
  isbn: string;
  description: string;
}

const emptyForm: BookForm ={
  title: '',
  autor: '',
  isbn: '',
  description: '',
};

interface BookDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function BookDetailsPage({
  params,
}: BookDetailsPageProps) {
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadBook() {
      try {
        // Get the ID from the Next.js dynamic route.
        const { id } = await params;

        if (cancelled) return;

        // Check whether the user is logged in.
        if (!sessionStorage.getItem('access_token')) {
          router.replace('/login');
          return;
        }

        // Fetch book details from the NestJS API.
        const response = await api.get<Book>(`/books/${id}`);

        if (!cancelled) {
          setBook(response.data);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this book. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBook();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        <p className="text-gray-600">Loading book details...</p>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl bg-gray-100 p-8">
        <p className="text-red-600">
          {error || 'Book not found.'}
        </p>

        <Link
          href="/"
          className="mt-4 inline-block text-blue-600 underline"
        >
          Back to books
        </Link>
      </main>
    );
  }

  const averageRating =
    book.reviews.length > 0
      ? book.reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        ) / book.reviews.length
      : 0;

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to books
        </Link>

        {/* Book information */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">
            {book.title}
          </h1>

          <p className="mt-2 text-gray-600">
            Written by {book.autor}
          </p>

          <p className="mt-4 text-sm text-gray-500">
            ISBN: {book.isbn}
          </p>
          <div className="mt-4">
          <FavoriteButton bookId={book.id} />
          </div>
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-900">
              About this book
            </h2>

            <p className="mt-2 whitespace-pre-wrap text-gray-700">
              {book.description ||
                'No description has been added yet.'}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Total copies</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {book.totalCopies}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                Available copies
              </p>
              <p className="mt-1 text-2xl font-bold text-green-700">
                {book.availableCopies}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Book status</p>
              <p
                className={`mt-1 font-semibold ${
                  book.isActive
                    ? 'text-green-700'
                    : 'text-red-600'
                }`}
              >
                {book.isActive ? 'Active' : 'Deactivated'}
              </p>
            </div>
          </div>
        </section>

        {/* Reader ratings and reviews */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">
            Reader ratings and reviews
          </h2>

          {book.reviews.length > 0 ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-3xl font-bold">
                  {averageRating.toFixed(1)}
                </span>

                <div>
                  <p className="text-xl text-amber-500">
                    {'★'.repeat(Math.round(averageRating))}
                    {'☆'.repeat(5 - Math.round(averageRating))}
                  </p>

                  <p className="text-sm text-gray-500">
                    Based on {book.reviews.length}{' '}
                    {book.reviews.length === 1
                      ? 'review'
                      : 'reviews'}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {book.reviews.map((review) => (
                  <article
                    key={review.id}
                    className="border-t pt-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">
                        {review.user.name}
                      </p>

                      <time className="text-sm text-gray-500">
                        {new Date(
                          review.createdAt,
                        ).toLocaleDateString()}
                      </time>
                    </div>

                    <p className="mt-1 text-amber-500">
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-gray-700">
                      {review.comment}
                    </p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-gray-500">
              No reader reviews yet.
            </p>
          )}
        </section>

        {/* Borrowing history */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">
            Borrowing history
          </h2>

          {book.borrowings.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="p-3 ">Reader</th>
                    <th className="p-3">Borrowed on</th>
                    <th className="p-3">Returned on</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {book.borrowings.map((borrowing) => (
                    <tr
                      key={borrowing.id}
                      className="border-b border-gray-100"
                    >
                      <td className="p-3 font-semibold text-black">
                        <Link 
                        href={`/users/${borrowing.user.id}`}
                        className="text-blue-600 hover:underline"
                        >
                          {borrowing.user.name}
                        </Link>
                      </td>

                      <td className="p-3 font-semibold text-black">
                        {new Date(
                          borrowing.borrowedAt,
                        ).toLocaleDateString()}
                      </td>

                      <td className="p-3 font-semibold text-black">
                        {borrowing.returnedAt
                          ? new Date(
                              borrowing.returnedAt,
                            ).toLocaleDateString()
                          : '—'}
                      </td>

                      <td className="p-3">
                        {borrowing.returnedAt ? (
                          <span className="text-green-700">
                            Returned
                          </span>
                        ) : (
                          <span className="text-orange-600">
                            Borrowed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-gray-500">
              No borrowing history yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

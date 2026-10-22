'use client';
import './profile.css';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../lib/api';

interface Book {
  id: number;
  title: string;
  autor: string;
  isbn?: string;
}

interface Borrowing {
  id: number;
  bookId: number;
  borrowedAt: string;
  returnedAt: string | null;
  book: Book;
}

interface MostBorrowedBook {
  book: Book;
  borrowCount: number;
}

interface Profile {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  statistics: {
    totalBorrowings: number;
    currentlyBorrowed: number;
    returnedBooks: number;
    favoriteBooks: number;
  };
  favoriteBooks: Book[];
  mostBorrowedBooks: MostBorrowedBook[];
  borrowingHistory: Borrowing[];
}

function formatDate(value?: string | null) {
  if (!value) return 'Not returned yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function UserProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const token = sessionStorage.getItem('access_token');

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response = await api.get<Profile>(
          `/users/${params.id}/profile`,
        );

        if (!cancelled) {
          setProfile(response.data);
        }
      } catch (err: unknown) {
        if (cancelled) return;

        const status = (
          err as { response?: { status?: number } }
        )?.response?.status;

        if (status === 401) {
          router.replace('/login');
          return;
        }

        setError(
          status === 404
            ? 'This user profile could not be found.'
            : 'Could not load this profile. Please try again.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">
          <div className="profile-spinner" />
          <p>Loading user profile...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="profile-page">
        <section className="profile-message">
          <div className="profile-message-icon">!</div>
          <h1>Profile unavailable</h1>
          <p>{error || 'This user profile could not be found.'}</p>
          <button
            className="profile-primary-button"
            onClick={() => router.back()}
          >
            Go back
          </button>
        </section>
      </main>
    );
  }

  const stats = [
    {
      icon: '📚',
      label: 'Books borrowed',
      value: profile.statistics?.totalBorrowings ?? 0,
      color: 'blue',
    },
    {
      icon: '↩️',
      label: 'Books returned',
      value: profile.statistics?.returnedBooks ?? 0,
      color: 'green',
    },
    {
      icon: '📖',
      label: 'Currently reading',
      value: profile.statistics?.currentlyBorrowed ?? 0,
      color: 'orange',
    },
    {
      icon: '♥',
      label: 'Favorite books',
      value:
        profile.statistics?.favoriteBooks ??
        profile.favoriteBooks?.length ??
        0,
      color: 'pink',
    },
  ];

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <nav className="profile-topbar">
          <Link href="/" className="profile-brand">
            <span className="profile-brand-icon">▤</span>
            <span>
              Library<span className="profile-brand-light">Space</span>
            </span>
          </Link>

          <Link href="/" className="profile-back-link">
            <span aria-hidden="true">←</span> Back to library
          </Link>
        </nav>

        <section className="profile-hero">
          <div className="profile-hero-decoration profile-decoration-one" />
          <div className="profile-hero-decoration profile-decoration-two" />

          <div className="profile-hero-content">
            <div className="profile-avatar">
              {getInitials(profile.name) || 'U'}
            </div>

            <div className="profile-identity">
              <span className="profile-eyebrow">READER PROFILE</span>
              <h1>{profile.name}</h1>
              <p className="profile-email">
                <span aria-hidden="true">✉</span> {profile.email}
              </p>
              <div className="profile-member-badge">
                <span aria-hidden="true">✦</span>
                Library member since {formatDate(profile.createdAt)}
              </div>
            </div>

            <div className="profile-member-number">
              <span>MEMBER ID</span>
              <strong>#{String(profile.id).padStart(4, '0')}</strong>
            </div>
          </div>
        </section>

        <section
          className="profile-stats-grid"
          aria-label="Reading statistics"
        >
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={`profile-stat-card stat-${stat.color}`}
            >
              <div className="profile-stat-top">
                <span className="profile-stat-icon">{stat.icon}</span>
                <span className="profile-stat-dot" />
              </div>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="profile-section">
          <div className="profile-section-heading">
            <div>
              <span className="profile-eyebrow">PERSONAL COLLECTION</span>
              <h2>
                Favorite books{' '}
                <span className="profile-count">
                  {profile.favoriteBooks?.length ?? 0}
                </span>
              </h2>
              <p>The books this reader has saved for later.</p>
            </div>
          </div>

          {profile.favoriteBooks?.length ? (
            <div className="profile-book-grid">
              {profile.favoriteBooks.map((book) => (
                <Link
                  href={`/books/${book.id}`}
                  className="profile-book-card"
                  key={book.id}
                >
                  <div className="profile-book-cover">
                    <span className="profile-cover-mark">▤</span>
                    <span className="profile-cover-label">FAVORITE</span>
                  </div>
                  <div className="profile-book-info">
                    <h3>{book.title}</h3>
                    <p>by {book.autor || 'Unknown author'}</p>
                    <span className="profile-book-link">
                      View book <span aria-hidden="true">↗</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="profile-empty">
              <span className="profile-empty-icon">♡</span>
              <div>
                <h3>No favorite books yet</h3>
                <p>When this reader saves a book, it will appear here.</p>
              </div>
            </div>
          )}
        </section>

        <section className="profile-section">
          <div className="profile-section-heading">
            <div>
              <span className="profile-eyebrow">READING TRENDS</span>
              <h2>Most borrowed books</h2>
              <p>The books this reader has borrowed most often.</p>
            </div>
          </div>

          {profile.mostBorrowedBooks?.length ? (
            <div className="profile-popular-list">
              {profile.mostBorrowedBooks.map((item, index) => (
                <Link
                  href={`/books/${item.book.id}`}
                  className="profile-popular-item"
                  key={item.book.id}
                >
                  <span className="profile-rank">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="profile-mini-cover">▤</div>
                  <div className="profile-popular-info">
                    <h3>{item.book.title}</h3>
                    <p>{item.book.autor || 'Unknown author'}</p>
                  </div>
                  <span className="profile-borrow-count">
                    {item.borrowCount}{' '}
                    {item.borrowCount === 1 ? 'borrow' : 'borrows'}
                  </span>
                  <span className="profile-arrow">↗</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="profile-empty">
              <span className="profile-empty-icon">▤</span>
              <div>
                <h3>No reading trends yet</h3>
                <p>Borrowing books will build this reading history.</p>
              </div>
            </div>
          )}
        </section>

        <section className="profile-section profile-history-section">
          <div className="profile-section-heading">
            <div>
              <span className="profile-eyebrow">ACTIVITY LOG</span>
              <h2>Borrowing history</h2>
              <p>A record of this reader’s library activity.</p>
            </div>
            <span className="profile-history-total">
              {profile.borrowingHistory?.length ?? 0} records
            </span>
          </div>

          {profile.borrowingHistory?.length ? (
            <div className="profile-table-wrap">
              <table className="profile-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Borrowed on</th>
                    <th>Returned on</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.borrowingHistory.map((borrowing) => (
                    <tr key={borrowing.id}>
                      <td>
                        <Link
                          href={`/books/${borrowing.book.id}`}
                          className="profile-history-book"
                        >
                          <span className="profile-table-book-icon">▤</span>
                          <span>
                            <strong>{borrowing.book.title}</strong>
                            <small>
                              {borrowing.book.autor || 'Unknown author'}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>{formatDate(borrowing.borrowedAt)}</td>
                      <td>{formatDate(borrowing.returnedAt)}</td>
                      <td>
                        <span
                          className={`profile-status ${
                            borrowing.returnedAt
                              ? 'status-returned'
                              : 'status-borrowed'
                          }`}
                        >
                          <span className="profile-status-dot" />
                          {borrowing.returnedAt ? 'Returned' : 'Borrowed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="profile-empty">
              <span className="profile-empty-icon">◷</span>
              <div>
                <h3>No borrowing history</h3>
                <p>There are no borrowing records for this reader yet.</p>
              </div>
            </div>
          )}
        </section>

        <footer className="profile-footer">
          <span>▤ LibrarySpace</span>
          <span>Every book opens a new world.</span>
        </footer>
      </div>
    </main>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="profile-page">
          <div className="profile-loading">
            <div className="profile-spinner" />
            <p>Loading user profile...</p>
          </div>
        </main>
      }
    >
      <UserProfileContent />
    </Suspense>
  );
}
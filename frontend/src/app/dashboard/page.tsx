
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import './dashboard.css';

type Role = 'USER' | 'ADMIN';

interface Book {
  id: number;
  title: string;
  autor?: string;
}

interface Borrowing {
  id: number;
  borrowedAt?: string;
  returnedAt?: string | null;
  dueDate?: string | null;
  status?: string;
  book?: Book;
}

interface DashboardData {
  totalBorrowings: number;
  currentBorrowings: number;
  returnedBorrowings: number;
  overdueBorrowings: number;
  recentActivity: Borrowing[];
  renewalSummary: {
    requested: number;
    approved: number;
    rejected: number;
  };
  favoriteBooks: Book[];
}

interface TokenPayload {
  role?: Role;
  exp?: number;
}

interface ActivityDay {
  date: string;
  label: string;
  total: number;
}

const emptyDashboard: DashboardData = {
  totalBorrowings: 0,
  currentBorrowings: 0,
  returnedBorrowings: 0,
  overdueBorrowings: 0,
  recentActivity: [],
  renewalSummary: {
    requested: 0,
    approved: 0,
    rejected: 0,
  },
  favoriteBooks: [],
};

const CHART_COLORS = {
  borrowed: '#3478f6',
  returned: '#35bd89',
};

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function readTokenRole(token: string): Role {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid access token');
  }

  const base64 = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const payload = JSON.parse(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
  ) as TokenPayload;

  if (payload.role !== 'ADMIN' && payload.role !== 'USER') {
    throw new Error('Invalid user role');
  }

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    throw new Error('Access token expired');
  }

  return payload.role;
}

function getLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function DashboardPage() {
  const router = useRouter();

  const [userRole, setUserRole] = useState<Role | null>(null);
  const [dashboard, setDashboard] =
    useState<DashboardData>(emptyDashboard);
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    router.replace('/login');
  }, [router]);

  const loadDashboard = useCallback(async () => {
    const token =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('access_token')
        : null;

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const role = readTokenRole(token);
      setUserRole(role);
    } catch {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.get('/dashboard/me');
      const data = response.data;

      setDashboard({
        totalBorrowings: data.totalBorrowings ?? 0,
        currentBorrowings: data.currentBorrowings ?? 0,
        returnedBorrowings: data.returnedBorrowings ?? 0,
        overdueBorrowings: data.overdueBorrowings ?? 0,
        recentActivity: Array.isArray(data.recentActivity)
          ? data.recentActivity
          : [],
        renewalSummary: {
          requested: data.renewalSummary?.requested ?? 0,
          approved: data.renewalSummary?.approved ?? 0,
          rejected: data.renewalSummary?.rejected ?? 0,
        },
        favoriteBooks: Array.isArray(data.favoriteBooks)
          ? data.favoriteBooks
          : [],
      });
    } catch (err: unknown) {
      const status = (
        err as { response?: { status?: number } }
      )?.response?.status;

      if (status === 401) {
        handleUnauthorized();
        return;
      }

      setError(
        status === 404
          ? 'The dashboard API was not found. Please check the backend dashboard route.'
          : 'Unable to load your dashboard. Please check that the backend is running and try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [router, handleUnauthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  const borrowingStatusData = useMemo(
    () => [
      {
        name: 'Currently borrowed',
        value: dashboard.currentBorrowings,
        color: CHART_COLORS.borrowed,
      },
      {
        name: 'Returned',
        value: dashboard.returnedBorrowings,
        color: CHART_COLORS.returned,
      },
    ],
    [dashboard.currentBorrowings, dashboard.returnedBorrowings],
  );

  // Calculate date-dependent activity data only after mounting.
  // This avoids using the current date during the initial render.
  useEffect(() => {
    const today = new Date();
    const days: ActivityDay[] = [];

    // Build the last seven calendar days, including today.
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      days.push({
        date: getLocalDateKey(date),
        label: date.toLocaleDateString(undefined, {
          weekday: 'short',
        }),
        total: 0,
      });
    }

    // Count borrowing records by their local borrowing date.
    for (const borrowing of dashboard.recentActivity) {
      if (!borrowing.borrowedAt) continue;

      const borrowedDate = new Date(borrowing.borrowedAt);

      if (Number.isNaN(borrowedDate.getTime())) continue;

      const key = getLocalDateKey(borrowedDate);
      const day = days.find((item) => item.date === key);

      if (day) {
        day.total += 1;
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivityData(days);
  }, [dashboard.recentActivity]);

  function logout() {
    handleUnauthorized();
  }

  if (loading) {
    return (
      <main className="reader-dashboard">
        <div className="reader-loading">
          <div className="reader-spinner" />
          <p>Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  if (!userRole) {
    return null;
  }

  return (
    <main className="reader-dashboard">
      <header className="reader-header">
        <div className="reader-brand">
          <div className="reader-brand-icon">📚</div>
          <div>
            <h1>Library Portal</h1>
            <p>Your personal reading space</p>
          </div>
        </div>

        <nav className="reader-nav" aria-label="Main navigation">
          <Link href="/">Browse Books</Link>

          <Link href="/dashboard" className="reader-nav-active">
            Dashboard
          </Link>

          <Link
            href={userRole === 'ADMIN' ? '/admin' : '/'}
            className="dashboard-primary-action inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold text-white"
          >
            ← Back to My Panel
          </Link>

          <button
            type="button"
            className="reader-logout"
            onClick={logout}
          >
            Log out
          </button>
        </nav>
      </header>

      {/* Welcome section */}
      <section className="reader-welcome">
        <div className="reader-welcome-copy">
          <p className="reader-eyebrow">YOUR PERSONAL LIBRARY</p>

          <h2>
            Welcome to your reading space <span>👋</span>
          </h2>

          <p>
            Every book opens a new world. Keep track of your reading,
            continue your journey, and discover your next favorite.
          </p>

          <div className="reader-welcome-meta">
            <div>
              <span className="reader-welcome-meta-icon">📚</span>
              <span>
                <strong>{dashboard.currentBorrowings}</strong>
                <small>Currently borrowed</small>
              </span>
            </div>

            <div>
              <span className="reader-welcome-meta-icon">✓</span>
              <span>
                <strong>{dashboard.returnedBorrowings}</strong>
                <small>Books completed</small>
              </span>
            </div>
          </div>
        </div>

        <div className="reader-welcome-side">
          <div className="reader-welcome-art" aria-hidden="true">
            <span className="reader-welcome-art-book book-one">📘</span>
            <span className="reader-welcome-art-book book-two">📗</span>
            <span className="reader-welcome-art-book book-three">📙</span>
            <span className="reader-welcome-sparkle sparkle-one">✦</span>
            <span className="reader-welcome-sparkle sparkle-two">✧</span>
            <span className="reader-welcome-art-circle" />
          </div>

          <Link href="/" className="reader-primary-link">
            Explore library <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {error && (
        <section className="reader-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadDashboard()}>
            Try again
          </button>
        </section>
      )}

      {/* Statistics cards */}
      <section
        className="reader-stat-grid"
        aria-label="Borrowing statistics"
      >
        <article className="reader-stat-card stat-total">
          <div className="reader-stat-top">
            <span className="reader-stat-icon">📚</span>
            <span className="reader-stat-badge">All time</span>
          </div>
          <p>Total Borrowings</p>
          <h3>{dashboard.totalBorrowings}</h3>
          <span className="reader-stat-caption">
            All borrowing records
          </span>
        </article>

        <article className="reader-stat-card stat-current">
          <div className="reader-stat-top">
            <span className="reader-stat-icon">📖</span>
            <span className="reader-stat-badge">Active</span>
          </div>
          <p>Currently Borrowed</p>
          <h3>{dashboard.currentBorrowings}</h3>
          <span className="reader-stat-caption">
            Books not yet returned
          </span>
        </article>

        <article className="reader-stat-card stat-returned">
          <div className="reader-stat-top">
            <span className="reader-stat-icon">✓</span>
            <span className="reader-stat-badge">Completed</span>
          </div>
          <p>Returned Books</p>
          <h3>{dashboard.returnedBorrowings}</h3>
          <span className="reader-stat-caption">
            Completed borrowing records
          </span>
        </article>

        <article className="reader-stat-card stat-overdue">
          <div className="reader-stat-top">
            <span className="reader-stat-icon">◷</span>
            <span className="reader-stat-badge">Attention</span>
          </div>
          <p>Overdue Books</p>
          <h3>{dashboard.overdueBorrowings}</h3>
          <span className="reader-stat-caption">
            Past their due date
          </span>
        </article>
      </section>

      {/* Analytics charts */}
      <section className="reader-analytics-grid">
        <article className="reader-panel reader-chart-panel">
          <div className="reader-panel-heading">
            <div>
              <p className="reader-eyebrow">BORROWING OVERVIEW</p>
              <h3>Reading activity</h3>
              <p className="reader-panel-description">
                Borrowing records from the last seven days
              </p>
            </div>
            <span className="reader-chart-icon">↗</span>
          </div>

          <div className="reader-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activityData}
                margin={{
                  top: 12,
                  right: 8,
                  left: -20,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e9eef7"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8490a5', fontSize: 12 }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8490a5', fontSize: 12 }}
                />

                <Tooltip
                  cursor={{ fill: '#f0f5ff' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e6ecf5',
                    boxShadow:
                      '0 8px 24px rgba(30, 64, 120, 0.08)',
                  }}
                />

                <Bar
                  dataKey="total"
                  name="Borrowings"
                  fill="#3478f6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="reader-panel reader-chart-panel">
          <div className="reader-panel-heading">
            <div>
              <p className="reader-eyebrow">YOUR COLLECTION</p>
              <h3>Borrowing status</h3>
              <p className="reader-panel-description">
                Current versus completed borrowings
              </p>
            </div>
          </div>

          <div className="reader-donut-wrap">
            <div className="reader-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={borrowingStatusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="68%"
                    outerRadius="90%"
                    paddingAngle={4}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {borrowingStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="reader-donut-center">
                <strong>
                  {dashboard.currentBorrowings +
                    dashboard.returnedBorrowings}
                </strong>
                <span>Tracked</span>
              </div>
            </div>

            <div className="reader-chart-legend">
              {borrowingStatusData.map((item) => (
                <div className="reader-legend-item" key={item.name}>
                  <span
                    className="reader-legend-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* Recent activity and renewal summary */}
      <section className="reader-content-grid">
        <article className="reader-panel reader-activity-panel">
          <div className="reader-panel-heading">
            <div>
              <p className="reader-eyebrow">YOUR HISTORY</p>
              <h3>Recent borrowing activity</h3>
            </div>
            <span className="reader-count">
              {dashboard.recentActivity.length} records
            </span>
          </div>

          {dashboard.recentActivity.length === 0 ? (
            <div className="reader-empty">
              <span>📘</span>
              <h4>Your reading journey starts here</h4>
              <p>You have no borrowing activity yet.</p>
              <Link href="/">Find your first book</Link>
            </div>
          ) : (
            <div className="reader-activity-list">
              {dashboard.recentActivity.map((item) => (
                <div className="reader-activity-item" key={item.id}>
                  <div className="reader-book-icon">📕</div>

                  <div className="reader-activity-info">
                    <h4>{item.book?.title ?? 'Book'}</h4>
                    <p>
                      {item.book?.autor
                        ? `By ${item.book.autor}`
                        : 'Library borrowing record'}
                    </p>
                    <span>
                      Borrowed {formatDate(item.borrowedAt)}
                    </span>
                  </div>

                  <span
                    className={
                      item.returnedAt
                        ? 'reader-status reader-status-returned'
                        : 'reader-status reader-status-borrowed'
                    }
                  >
                    {item.returnedAt ? 'Returned' : 'Borrowed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="reader-panel">
          <div className="reader-panel-heading">
            <div>
              <p className="reader-eyebrow">RENEWALS</p>
              <h3>Renewal summary</h3>
            </div>
            <span className="reader-renewal-icon">🔄</span>
          </div>

          <div className="reader-renewal-list">
            <div>
              <span>Requested</span>
              <strong>{dashboard.renewalSummary.requested}</strong>
            </div>
            <div>
              <span>Approved</span>
              <strong>{dashboard.renewalSummary.approved}</strong>
            </div>
            <div>
              <span>Rejected</span>
              <strong>{dashboard.renewalSummary.rejected}</strong>
            </div>
          </div>

          <p className="reader-note">
            Renewal figures depend on the renewal data returned by
            your backend.
          </p>
        </article>
      </section>

      {/* Favorite books */}
      <section className="reader-panel reader-favorites-panel">
        <div className="reader-panel-heading">
          <div>
            <p className="reader-eyebrow">SAVED FOR LATER</p>
            <h3>My favorite books</h3>
            <p className="reader-panel-description">
              Books you have added to your favorites.
            </p>
          </div>

          <Link href="/" className="reader-text-link">
            Browse books →
          </Link>
        </div>

        {dashboard.favoriteBooks.length === 0 ? (
          <div className="reader-empty reader-favorites-empty">
            <span>♡</span>
            <h4>No favorite books yet</h4>
            <p>
              Browse the library and save books you want to read.
            </p>
            <Link href="/">Explore the library</Link>
          </div>
        ) : (
          <div className="reader-favorite-grid">
            {dashboard.favoriteBooks.map((book) => (
              <article className="reader-favorite-card" key={book.id}>
                <div className="reader-favorite-cover">📚</div>
                <div>
                  <h4>{book.title}</h4>
                  <p>{book.autor || 'Author not listed'}</p>
                  <Link href={`/books/${book.id}`}>
                    View book →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="reader-footer">
        <p>Library Portal · Your next great read is waiting.</p>
      </footer>
    </main>
  );
}

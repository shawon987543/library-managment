'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';

export default function FavoriteButton({
  bookId,
}: {
  bookId: number;
}) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      try {
        const token = sessionStorage.getItem('access_token');

        if (!token) {
          if (!cancelled) setLoading(false);
          return;
        }

        const response = await api.get<
          { id: number }[]
        >('/favorites');

        if (!cancelled) {
          setIsFavorite(
            response.data.some((book) => book.id === bookId),
          );
        }
      } catch {
        if (!cancelled) {
          setError('Could not load favorite status.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFavorites();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  async function toggleFavorite() {
    const token = sessionStorage.getItem('access_token');

    if (!token) {
      router.push('/login');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isFavorite) {
        await api.delete(`/favorites/${bookId}`);
        setIsFavorite(false);
      } else {
        await api.post(`/favorites/${bookId}`);
        setIsFavorite(true);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem('access_token');
        router.replace('/login');
        return;
      }

      setError(
        err.response?.data?.message ||
          'Could not update favorite status.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={loading || saving}
        aria-pressed={isFavorite}
      >
        {loading
          ? 'Loading...'
          : saving
            ? 'Saving...'
            : isFavorite
              ? '❤️ Remove Favorite'
              : '♡ Add to Favorites'}
      </button>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}

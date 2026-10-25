'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  message?: string;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  // Read the registration status in the browser.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get('registered') === 'true');
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });
      const token = response.data.access_token;
      const refreshToken = response.data.refresh_token;

      if (!token || !refreshToken) {
        setError(
          'Login succeeded, but the access token was not returned.',
        );
        return;
      }

      // Temporary setup for learning and development.
      sessionStorage.setItem('access_token', token);
      sessionStorage.setItem('refresh_token', refreshToken);
      
      try {
        const payloadPart = token.split('.')[1];

        if(!payloadPart){
            throw new Error('Invalid access token');
        }

        const base64 = payloadPart
        .replace(/-/g, '+')
        .replace(/_/g, '/');

        const payload = JSON.parse(
            atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
        ) as {
            role?: string;
            email?: string;
        };

        console.log('Logged-in email:', payload.email);
        console.log('Logged-in role:', payload.role);

        if(payload.role?.toUpperCase() === 'ADMIN'){
          window.location.replace('/admin');

        } else if(payload.role?.toUpperCase() === 'USER'){
          window.location.replace('/');

        } else {
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          throw new Error('Invalid user role');
          setError(
            'Your account role is missing or invalid. Please contact the administrator.',
          );
        }
      } catch {
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        setError('Could not verify your login role. Please try again.');
      }
      
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const apiError = (
          err as {
            response?: {
              data?: { message?: string | string[] };
            };
          }
        ).response;

        const apiMessage = apiError?.data?.message;

        setError(
          Array.isArray(apiMessage)
            ? apiMessage.join(', ')
            : apiMessage || 'Invalid email or password.',
        );
      } else {
        setError('Could not connect to the server.');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome Back
        </h1>

        <p className="mt-2 text-gray-600">
          Login to your library account.
        </p>

        {registered && (
          <p className="mt-5 rounded-lg bg-green-100 p-3 text-sm text-green-800">
            Registration successful! You can now log in.
          </p>
        )}

        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-semibold text-gray-900"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block font-semibold text-gray-900"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className={inputClass}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-100 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-700">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-blue-700 hover:underline"
          >
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
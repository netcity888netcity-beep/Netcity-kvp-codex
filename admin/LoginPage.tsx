'use client';

import React, { FormEvent, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';

interface LoginPageProps {
  onSubmit?: (email: string, password: string) => void | Promise<void>;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit?.(email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <section className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <LockKeyhole className="h-6 w-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Вход в KVP</h1>
          <p className="mt-2 text-sm text-gray-400">Врата в панель управления</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">Электронная почта</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-gray-600 focus:border-blue-500"
                placeholder="architect@example.com"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-gray-300">Пароль</span>
            <span className="relative block">
              <LockKeyhole className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-gray-600 focus:border-blue-500"
                placeholder="Введите пароль"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-600">
          KVP Protocol v0.1 · Маяк: netcity888netcity@gmail.com
        </p>
      </section>
    </main>
  );
};

export default LoginPage;

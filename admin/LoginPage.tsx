'use client';

import React, { FormEvent, useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';

interface LoginPageProps {
  onSubmit?: (email: string, password: string) => void | Promise<void>;
  email?: string;
  setupRequired?: boolean;
  error?: string;
}

const LoginPage: React.FC<LoginPageProps> = ({
  onSubmit,
  email: ownerEmail = '',
  setupRequired = false,
  error = '',
}) => {
  const [email, setEmail] = useState(ownerEmail);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    if (setupRequired && password.length < 10) {
      setLocalError('Пароль должен содержать не менее 10 символов.');
      return;
    }
    if (setupRequired && password !== confirmation) {
      setLocalError('Пароли не совпадают.');
      return;
    }
    setIsSubmitting(true);

    try {
      await onSubmit?.(email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-aside">
        <div className="brand"><span className="brand-mark">K</span>KVP / CONTROL</div>
        <div>
          <div className="eyebrow">Kernel Validation Protocol</div>
          <h1>Управляйте<br />системой.<br />Без шума.</h1>
          <p>Единая консоль контроля локальной инфраструктуры, политик и операционных контуров.</p>
        </div>
        <div className="signal"><span className="signal-dot" /> ЛОКАЛЬНЫЙ КОНТУР · ГОТОВ</div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="eyebrow">Защищённый доступ</div>
          <h2>Вход в консоль</h2>
          <p className="muted">
            {setupRequired ? 'Создайте локальный пароль владельца контура.' : 'Авторизация владельца контура.'}
          </p>
          <form onSubmit={handleSubmit}>
          <label className="field">
            Электронная почта
            <span className="input-wrap">
              <Mail size={18} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                readOnly={Boolean(ownerEmail)}
              />
            </span>
          </label>
          {setupRequired && (
            <label className="field">
              Подтверждение пароля
              <span className="input-wrap">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Повторите пароль"
                />
              </span>
            </label>
          )}

          {(localError || error) && <p className="auth-error" role="alert">{localError || error}</p>}
          <label className="field">
            Пароль
            <span className="input-wrap">
              <LockKeyhole size={18} />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="primary"
          >
            {isSubmitting ? 'Проверка…' : setupRequired ? 'Создать профиль и войти' : 'Войти'}
          </button>
          </form>
          <p className="fineprint">DIRECTORMIRA · OWNER ARCHITECT · LOCAL CREDENTIAL</p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;

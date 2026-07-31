import { FormEvent, useState } from 'react';
import { KeyRound, LockKeyhole, TerminalSquare } from 'lucide-react';

interface PairingPageProps {
  error: string;
  sessionOpened: boolean;
  onPair: (code: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onCancel: () => void;
}

export default function PairingPage({ error, sessionOpened, onPair, onRetry, onCancel }: PairingPageProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    if (sessionOpened) {
      setSubmitting(true);
      try {
        await onRetry();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!/^\d{8}$/.test(code)) {
      setLocalError('Введите восемь цифр из видимого gateway-терминала.');
      return;
    }
    setSubmitting(true);
    try {
      await onPair(code);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pairing-shell">
      <section className="pairing-card">
        <div className="pairing-symbol"><TerminalSquare /></div>
        <div className="eyebrow">NETCITY–KVP · M2 SESSION BOUNDARY</div>
        <h1>Сопряжение локального интерфейса</h1>
        <p className="muted">
          Найдите строку <b>Pairing code</b> в видимом окне KVP Gateway.
          Код используется один раз и не является паролем владельца.
        </p>
        <form onSubmit={submit}>
          {!sessionOpened && <label className="field">
            Одноразовый код
            <span className="input-wrap pairing-input">
              <KeyRound size={18} />
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{8}"
                maxLength={8}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000"
                aria-label="Восьмизначный код сопряжения"
              />
            </span>
          </label>}
          {(localError || error) && <p className="auth-error" role="alert">{localError || error}</p>}
          <button className="primary" type="submit" disabled={submitting}>
            <LockKeyhole size={17} /> {submitting
              ? 'Проверка…'
              : sessionOpened ? 'Повторить защищённое чтение' : 'Открыть M2-сеанс'}
          </button>
          <button className="pairing-cancel" type="button" onClick={onCancel}>Вернуться к входу</button>
        </form>
        <div className="pairing-boundary">
          {sessionOpened ? 'M2 session открыт в памяти · gateway snapshot пока недоступен' : 'Bearer хранится только в памяти вкладки · 0 NCY · mutations disabled'}
        </div>
      </section>
    </main>
  );
}

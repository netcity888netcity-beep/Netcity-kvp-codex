import { useState } from 'react';
import Dashboard from '../Dashboard';
import LoginPage from '../LoginPage';
import PairingPage from './PairingPage';
import {
  hasOwnerCredential,
  initializeOwnerPassword,
  OWNER_PROFILE,
  verifyOwnerPassword,
} from './auth';
import { KvpHumanState, openGatewaySession, readHumanState } from './gateway';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [setupRequired, setSetupRequired] = useState(() => !hasOwnerCredential());
  const [authError, setAuthError] = useState('');
  const [humanState, setHumanState] = useState<KvpHumanState | null>(null);
  const [pairingError, setPairingError] = useState('');
  const [gatewayToken, setGatewayToken] = useState('');

  const readProtectedState = async (token: string) => {
    try {
      const state = await readHumanState(token);
      setHumanState(state);
      setPairingError('');
    } catch (error) {
      setPairingError(error instanceof Error ? error.message : 'Защищённое состояние недоступно.');
    }
  };

  if (!authenticated) {
    return (
      <LoginPage
        email={OWNER_PROFILE.email}
        setupRequired={setupRequired}
        error={authError}
        onSubmit={async (email, password) => {
          setAuthError('');
          if (email.toLowerCase() !== OWNER_PROFILE.email) {
            setAuthError('Доступ разрешён только владельцу контура.');
            return;
          }
          if (setupRequired) {
            await initializeOwnerPassword(password);
            setSetupRequired(false);
            setAuthenticated(true);
            return;
          }
          if (!(await verifyOwnerPassword(password))) {
            setAuthError('Неверный локальный пароль.');
            return;
          }
          setAuthenticated(true);
        }}
      />
    );
  }

  if (!humanState) {
    return (
      <PairingPage
        error={pairingError}
        sessionOpened={gatewayToken.length > 0}
        onCancel={() => {
          setPairingError('');
          setGatewayToken('');
          setAuthenticated(false);
        }}
        onRetry={() => readProtectedState(gatewayToken)}
        onPair={async (code) => {
          setPairingError('');
          try {
            const token = await openGatewaySession(code);
            setGatewayToken(token);
            await readProtectedState(token);
          } catch (error) {
            setPairingError(error instanceof Error ? error.message : 'Сопряжение не выполнено.');
          }
        }}
      />
    );
  }

  return (
    <Dashboard
      userName={OWNER_PROFILE.name}
      userRole={OWNER_PROFILE.role}
      userEmail={OWNER_PROFILE.email}
      humanState={humanState}
      gatewayStatus="verified"
      onLogout={() => {
        setHumanState(null);
        setGatewayToken('');
        setPairingError('');
        setAuthenticated(false);
      }}
    />
  );
}

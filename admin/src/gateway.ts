const KVP_FIXTURE_ORIGIN = 'http://127.0.0.1:18443';
export const KVP_FIXTURE_URL = `${KVP_FIXTURE_ORIGIN}/v1/human/state`;

export interface KvpConsentState {
  decision: 'DENIED' | 'GRANTED';
  revision: number;
}

export interface KvpHumanState {
  protocol: 'netcity-kvp-human';
  fixture_version: 'M2';
  mode: 'loopback_authenticated_read_only';
  identity: {
    principal_id: string;
    login_email: string;
    display_name: string;
    kind: 'HUMAN';
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    revision: number;
  };
  wallet: {
    account_id: string;
    currency: 'NCY';
    balance_minor: number;
    status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
    sandbox_only: true;
    transfers_enabled: false;
  };
  assistants: {
    inference_enabled: false;
    payment_authority: false;
  };
  bridges: {
    device_connected: false;
    actuation_enabled: false;
    classification: 'VISION_RESEARCH';
  };
  consents: Record<string, KvpConsentState>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDeniedConsent = (value: unknown): value is KvpConsentState =>
  isObject(value)
  && value.decision === 'DENIED'
  && Number.isSafeInteger(value.revision)
  && Number(value.revision) >= 0;

export function isKvpHumanState(value: unknown): value is KvpHumanState {
  if (!isObject(value) || !isObject(value.identity) || !isObject(value.wallet)) return false;
  if (!isObject(value.assistants) || !isObject(value.bridges) || !isObject(value.consents)) return false;

  return value.protocol === 'netcity-kvp-human'
    && value.fixture_version === 'M2'
    && value.mode === 'loopback_authenticated_read_only'
    && value.identity.kind === 'HUMAN'
    && ['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(String(value.identity.status))
    && typeof value.identity.principal_id === 'string'
    && value.identity.principal_id.startsWith('principal:')
    && typeof value.identity.login_email === 'string'
    && typeof value.identity.display_name === 'string'
    && Number.isSafeInteger(value.identity.revision)
    && value.wallet.account_id === `account:${value.identity.principal_id}`
    && value.wallet.currency === 'NCY'
    && Number.isSafeInteger(value.wallet.balance_minor)
    && Number(value.wallet.balance_minor) >= 0
    && ['ACTIVE', 'FROZEN', 'CLOSED'].includes(String(value.wallet.status))
    && value.wallet.sandbox_only === true
    && value.wallet.transfers_enabled === false
    && value.assistants.inference_enabled === false
    && value.assistants.payment_authority === false
    && value.bridges.device_connected === false
    && value.bridges.actuation_enabled === false
    && value.bridges.classification === 'VISION_RESEARCH'
    && isDeniedConsent(value.consents.nervous_system_research)
    && isDeniedConsent(value.consents.genetic_data_research);
}

export async function openGatewaySession(pairingCode: string): Promise<string> {
  if (!/^\d{8}$/.test(pairingCode)) throw new Error('Введите восемь цифр из gateway-терминала.');
  const response = await fetch(`${KVP_FIXTURE_ORIGIN}/v1/session`, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairing_code: pairingCode }),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    if (isObject(value) && value.error === 'pairing_invalid') {
      throw new Error(`Код не принят. Осталось попыток: ${String(value.attempts_remaining)}.`);
    }
    if (isObject(value) && value.error === 'pairing_locked') {
      throw new Error('Сопряжение заблокировано. Перезапустите локальный gateway.');
    }
    if (isObject(value) && value.error === 'pairing_already_used') {
      throw new Error('Код уже использован. Перезапустите gateway для нового сеанса.');
    }
    throw new Error(`Gateway отказал в сопряжении: HTTP ${response.status}.`);
  }
  if (!isObject(value)
    || typeof value.session_token !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.session_token)
    || value.token_type !== 'Bearer'
    || value.expires_on_restart !== true) {
    throw new Error('Gateway вернул несовместимый session contract.');
  }
  return value.session_token;
}

export async function readHumanState(
  sessionToken: string,
  signal?: AbortSignal,
): Promise<KvpHumanState> {
  if (!/^[a-f0-9]{64}$/.test(sessionToken)) throw new Error('Локальный session token недействителен.');
  const response = await fetch(KVP_FIXTURE_URL, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { Authorization: `Bearer ${sessionToken}` },
    signal,
  });
  if (!response.ok) throw new Error(`KVP fixture returned HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!isKvpHumanState(value)) throw new Error('KVP fixture returned an invalid contract');
  return value;
}

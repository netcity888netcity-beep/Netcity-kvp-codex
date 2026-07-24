#![forbid(unsafe_code)]

use std::{
    collections::HashMap,
    fmt,
    sync::{Mutex, MutexGuard},
    time::{Duration, SystemTime},
};
use thiserror::Error;

pub const SESSION_TOKEN_BYTES: usize = 32;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    Observer,
    Operator,
    Administrator,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Operation {
    GetStatus,
    UpdateParameters,
    TriggerCompaction,
    SwitchModel,
    InvalidateCache,
}

#[derive(Clone, Eq, Hash, PartialEq)]
pub struct SessionToken([u8; SESSION_TOKEN_BYTES]);

impl SessionToken {
    pub fn as_bytes(&self) -> &[u8; SESSION_TOKEN_BYTES] {
        &self.0
    }
}

impl fmt::Debug for SessionToken {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("SessionToken([REDACTED])")
    }
}

struct Session {
    client_id: String,
    role: Role,
    expires_at: SystemTime,
    last_sequence: u64,
}

#[derive(Debug, Error, Eq, PartialEq)]
pub enum AuthorizationError {
    #[error("session is unknown")]
    UnknownSession,
    #[error("session has expired")]
    ExpiredSession,
    #[error("sequence number is not strictly increasing")]
    ReplayOrReordering,
    #[error("role is not authorized for this operation")]
    PermissionDenied,
    #[error("session store lock is poisoned")]
    StoreUnavailable,
    #[error("operating system entropy source is unavailable")]
    EntropyUnavailable,
}

#[derive(Debug, Eq, PartialEq)]
pub struct AuthorizedCommand {
    pub client_id: String,
    pub role: Role,
    pub sequence: u64,
    pub operation: Operation,
}

#[derive(Default)]
pub struct SessionStore {
    sessions: Mutex<HashMap<SessionToken, Session>>,
}

impl SessionStore {
    pub fn open(
        &self,
        client_id: impl Into<String>,
        role: Role,
        ttl: Duration,
        now: SystemTime,
    ) -> Result<SessionToken, AuthorizationError> {
        let mut token = [0_u8; SESSION_TOKEN_BYTES];
        getrandom::fill(&mut token).map_err(|_| AuthorizationError::EntropyUnavailable)?;
        let token = SessionToken(token);
        let session = Session {
            client_id: client_id.into(),
            role,
            expires_at: now + ttl,
            last_sequence: 0,
        };

        self.lock()?.insert(token.clone(), session);
        Ok(token)
    }

    pub fn authorize(
        &self,
        token: &SessionToken,
        sequence: u64,
        operation: Operation,
        now: SystemTime,
    ) -> Result<AuthorizedCommand, AuthorizationError> {
        let mut sessions = self.lock()?;
        let session = sessions
            .get_mut(token)
            .ok_or(AuthorizationError::UnknownSession)?;

        if now >= session.expires_at {
            sessions.remove(token);
            return Err(AuthorizationError::ExpiredSession);
        }
        if sequence <= session.last_sequence {
            return Err(AuthorizationError::ReplayOrReordering);
        }
        if !is_allowed(session.role, operation) {
            return Err(AuthorizationError::PermissionDenied);
        }

        session.last_sequence = sequence;
        Ok(AuthorizedCommand {
            client_id: session.client_id.clone(),
            role: session.role,
            sequence,
            operation,
        })
    }

    pub fn revoke(&self, token: &SessionToken) -> Result<bool, AuthorizationError> {
        Ok(self.lock()?.remove(token).is_some())
    }

    fn lock(&self) -> Result<MutexGuard<'_, HashMap<SessionToken, Session>>, AuthorizationError> {
        self.sessions
            .lock()
            .map_err(|_| AuthorizationError::StoreUnavailable)
    }
}

fn is_allowed(role: Role, operation: Operation) -> bool {
    match role {
        Role::Observer => operation == Operation::GetStatus,
        Role::Operator => matches!(
            operation,
            Operation::GetStatus | Operation::UpdateParameters | Operation::TriggerCompaction
        ),
        Role::Administrator => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> SystemTime {
        SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000)
    }

    #[test]
    fn observer_can_read_status() {
        let store = SessionStore::default();
        let token = store
            .open("observer-1", Role::Observer, Duration::from_secs(60), now())
            .unwrap();

        let command = store
            .authorize(&token, 1, Operation::GetStatus, now())
            .unwrap();

        assert_eq!(command.client_id, "observer-1");
    }

    #[test]
    fn token_debug_output_is_redacted() {
        let store = SessionStore::default();
        let token = store
            .open("observer-1", Role::Observer, Duration::from_secs(60), now())
            .unwrap();

        assert_eq!(format!("{token:?}"), "SessionToken([REDACTED])");
    }

    #[test]
    fn observer_cannot_mutate_engine() {
        let store = SessionStore::default();
        let token = store
            .open("observer-1", Role::Observer, Duration::from_secs(60), now())
            .unwrap();

        assert_eq!(
            store.authorize(&token, 1, Operation::SwitchModel, now()),
            Err(AuthorizationError::PermissionDenied)
        );
    }

    #[test]
    fn sequence_cannot_be_replayed() {
        let store = SessionStore::default();
        let token = store
            .open("operator-1", Role::Operator, Duration::from_secs(60), now())
            .unwrap();
        store
            .authorize(&token, 7, Operation::UpdateParameters, now())
            .unwrap();

        assert_eq!(
            store.authorize(&token, 7, Operation::GetStatus, now()),
            Err(AuthorizationError::ReplayOrReordering)
        );
    }

    #[test]
    fn expired_session_is_removed() {
        let store = SessionStore::default();
        let token = store
            .open("operator-1", Role::Operator, Duration::from_secs(1), now())
            .unwrap();
        let later = now() + Duration::from_secs(2);

        assert_eq!(
            store.authorize(&token, 1, Operation::GetStatus, later),
            Err(AuthorizationError::ExpiredSession)
        );
        assert_eq!(
            store.authorize(&token, 2, Operation::GetStatus, later),
            Err(AuthorizationError::UnknownSession)
        );
    }

    #[test]
    fn revoked_session_is_rejected() {
        let store = SessionStore::default();
        let token = store
            .open(
                "admin-1",
                Role::Administrator,
                Duration::from_secs(60),
                now(),
            )
            .unwrap();

        assert!(store.revoke(&token).unwrap());
        assert_eq!(
            store.authorize(&token, 1, Operation::InvalidateCache, now()),
            Err(AuthorizationError::UnknownSession)
        );
    }
}

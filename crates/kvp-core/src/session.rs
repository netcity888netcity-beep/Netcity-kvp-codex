use std::collections::HashMap;
use std::fmt;
use std::time::{Duration, Instant};

use uuid::Uuid;

pub const DEFAULT_SESSION_TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KvError {
    SessionNotFound,
    SessionExpired,
    ClientMismatch,
    SequenceError,
    Forbidden,
    TransportError(String),
}

impl fmt::Display for KvError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SessionNotFound => f.write_str("session not found"),
            Self::SessionExpired => f.write_str("session expired"),
            Self::ClientMismatch => f.write_str("client id does not match the session binding"),
            Self::SequenceError => f.write_str("command sequence number overflow"),
            Self::Forbidden => f.write_str("operation is not permitted for this role"),
            Self::TransportError(message) => write!(f, "transport error: {message}"),
        }
    }
}

impl std::error::Error for KvError {}

#[derive(Debug, Clone)]
pub struct Session {
    id: String,
    client_id: String,
    created_at: Instant,
    expires_at: Instant,
    sequence: u64,
}

impl Session {
    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    pub fn created_at(&self) -> Instant {
        self.created_at
    }

    pub fn expires_at(&self) -> Instant {
        self.expires_at
    }

    pub fn sequence(&self) -> u64 {
        self.sequence
    }

    pub fn is_expired(&self) -> bool {
        self.is_expired_at(Instant::now())
    }

    pub fn is_expired_at(&self, now: Instant) -> bool {
        now >= self.expires_at
    }

    fn next_sequence(&mut self) -> Result<u64, KvError> {
        self.sequence = self
            .sequence
            .checked_add(1)
            .ok_or(KvError::SequenceError)?;
        Ok(self.sequence)
    }
}

#[derive(Debug)]
pub struct SessionManager {
    sessions: HashMap<String, Session>,
    ttl: Duration,
}

impl SessionManager {
    pub fn new(ttl: Duration) -> Self {
        Self {
            sessions: HashMap::new(),
            ttl,
        }
    }

    pub fn create_session(&mut self, client_id: &str) -> Session {
        let now = Instant::now();
        let session = Session {
            id: Uuid::new_v4().to_string(),
            client_id: client_id.to_owned(),
            created_at: now,
            expires_at: now + self.ttl,
            sequence: 0,
        };

        self.sessions.insert(session.id.clone(), session.clone());
        session
    }

    pub fn validate_and_bind(
        &mut self,
        session_id: &str,
        client_id: &str,
    ) -> Result<Session, KvError> {
        let now = Instant::now();

        let expired = match self.sessions.get(session_id) {
            Some(session) => session.is_expired_at(now),
            None => return Err(KvError::SessionNotFound),
        };

        if expired {
            self.sessions.remove(session_id);
            return Err(KvError::SessionExpired);
        }

        let session = self
            .sessions
            .get(session_id)
            .ok_or(KvError::SessionNotFound)?;

        if session.client_id != client_id {
            return Err(KvError::ClientMismatch);
        }

        Ok(session.clone())
    }

    pub fn increment_sequence(&mut self, session_id: &str) -> Result<u64, KvError> {
        let now = Instant::now();

        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or(KvError::SessionNotFound)?;

        if session.is_expired_at(now) {
            return Err(KvError::SessionExpired);
        }

        session.next_sequence()
    }

    pub fn len(&self) -> usize {
        self.sessions.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new(DEFAULT_SESSION_TTL)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manager() -> SessionManager {
        SessionManager::new(Duration::from_secs(60))
    }

    #[test]
    fn creates_session_with_unique_id_and_bound_client() {
        let mut manager = manager();

        let first = manager.create_session("client-1");
        let second = manager.create_session("client-2");

        assert_ne!(first.id(), second.id());
        assert_eq!(first.client_id(), "client-1");
        assert_eq!(second.client_id(), "client-2");
        assert_eq!(first.sequence(), 0);
        assert!(first.expires_at() > first.created_at());
        assert!(!first.is_expired());
        assert_eq!(manager.len(), 2);
    }

    #[test]
    fn validates_session_for_matching_client() {
        let mut manager = manager();
        let session = manager.create_session("client-1");

        let validated = manager
            .validate_and_bind(session.id(), "client-1")
            .expect("session should be valid");

        assert_eq!(validated.id(), session.id());
        assert_eq!(validated.client_id(), "client-1");
    }

    #[test]
    fn rejects_unknown_session() {
        let mut manager = manager();

        let error = manager
            .validate_and_bind("missing-session", "client-1")
            .unwrap_err();

        assert_eq!(error, KvError::SessionNotFound);
    }

    #[test]
    fn rejects_client_id_mismatch() {
        let mut manager = manager();
        let session = manager.create_session("client-1");

        let error = manager
            .validate_and_bind(session.id(), "client-2")
            .unwrap_err();

        assert_eq!(error, KvError::ClientMismatch);
    }

    #[test]
    fn rejects_expired_session_and_removes_it() {
        let mut manager = SessionManager::new(Duration::ZERO);
        let session = manager.create_session("client-1");

        let error = manager
            .validate_and_bind(session.id(), "client-1")
            .unwrap_err();

        assert_eq!(error, KvError::SessionExpired);
        assert_eq!(manager.len(), 0);
    }

    #[test]
    fn increments_sequence_monotonically() {
        let mut manager = manager();
        let session = manager.create_session("client-1");

        assert_eq!(manager.increment_sequence(session.id()).unwrap(), 1);
        assert_eq!(manager.increment_sequence(session.id()).unwrap(), 2);
        assert_eq!(manager.increment_sequence(session.id()).unwrap(), 3);

        let validated = manager
            .validate_and_bind(session.id(), "client-1")
            .unwrap();

        assert_eq!(validated.sequence(), 3);
    }

    #[test]
    fn rejects_sequence_overflow() {
        let mut manager = manager();
        let session = manager.create_session("client-1");

        manager.sessions.get_mut(session.id()).unwrap().sequence = u64::MAX;

        assert_eq!(
            manager.increment_sequence(session.id()).unwrap_err(),
            KvError::SequenceError
        );
    }

    #[test]
    fn rejects_sequence_increment_for_missing_or_expired_session() {
        let mut manager = SessionManager::new(Duration::ZERO);
        let session = manager.create_session("client-1");

        assert_eq!(
            manager.increment_sequence(session.id()).unwrap_err(),
            KvError::SessionExpired
        );
        assert_eq!(
            manager.increment_sequence("missing-session").unwrap_err(),
            KvError::SessionNotFound
        );
    }
}

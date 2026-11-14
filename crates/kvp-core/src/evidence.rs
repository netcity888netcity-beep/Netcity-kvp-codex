use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::auth::Action;
use crate::session::KvError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvidenceStatus {
    Success,
    Denied(KvError),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvidenceRecord {
    command_id: Uuid,
    session_id: String,
    action: Action,
    status: EvidenceStatus,
    timestamp: u64,
}

impl EvidenceRecord {
    pub fn command_id(&self) -> &Uuid {
        &self.command_id
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn action(&self) -> &Action {
        &self.action
    }

    pub fn status(&self) -> &EvidenceStatus {
        &self.status
    }

    pub fn timestamp(&self) -> u64 {
        self.timestamp
    }
}

#[derive(Debug, Default)]
pub struct EvidenceManager {
    records: Vec<EvidenceRecord>,
}

impl EvidenceManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(&mut self, session_id: &str, action: &Action, result: &Result<(), KvError>) {
        let status = match result {
            Ok(()) => EvidenceStatus::Success,
            Err(error) => EvidenceStatus::Denied(error.clone()),
        };

        self.records.push(EvidenceRecord {
            command_id: Uuid::new_v4(),
            session_id: session_id.to_owned(),
            action: *action,
            status,
            timestamp: unix_timestamp_secs(),
        });
    }

    pub fn records(&self) -> &[EvidenceRecord] {
        &self.records
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }
}

fn unix_timestamp_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_successful_result() {
        let mut manager = EvidenceManager::new();

        manager.record("session-1", &Action::ReadStatus, &Ok(()));

        assert_eq!(manager.len(), 1);

        let record = &manager.records()[0];
        assert_eq!(record.session_id(), "session-1");
        assert_eq!(record.action(), &Action::ReadStatus);
        assert_eq!(record.status(), &EvidenceStatus::Success);
        assert!(record.timestamp() > 0);
    }

    #[test]
    fn records_denied_result_with_error() {
        let mut manager = EvidenceManager::new();

        manager.record(
            "session-1",
            &Action::CreateFleet,
            &Err(KvError::Forbidden),
        );

        let record = &manager.records()[0];
        assert_eq!(
            record.status(),
            &EvidenceStatus::Denied(KvError::Forbidden)
        );
    }

    #[test]
    fn assigns_unique_command_ids() {
        let mut manager = EvidenceManager::new();

        manager.record("session-1", &Action::ReadStatus, &Ok(()));
        manager.record("session-1", &Action::ReadStatus, &Ok(()));

        assert_ne!(
            manager.records()[0].command_id(),
            manager.records()[1].command_id()
        );
    }
}

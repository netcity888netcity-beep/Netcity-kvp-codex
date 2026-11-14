use crate::auth::{check_permission, Action, Role};
use crate::evidence::EvidenceManager;
use crate::session::{KvError, SessionManager};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Command {
    pub session_id: String,
    pub client_id: String,
    pub sequence: u64,
    pub action: Action,
}

#[derive(Debug)]
pub struct CommandProcessor {
    sessions: SessionManager,
    evidence: EvidenceManager,
}

impl CommandProcessor {
    pub fn new(sessions: SessionManager) -> Self {
        Self::with_evidence(sessions, EvidenceManager::new())
    }

    pub fn with_evidence(sessions: SessionManager, evidence: EvidenceManager) -> Self {
        Self { sessions, evidence }
    }

    pub fn session_manager(&self) -> &SessionManager {
        &self.sessions
    }

    pub fn session_manager_mut(&mut self) -> &mut SessionManager {
        &mut self.sessions
    }

    pub fn evidence(&self) -> &EvidenceManager {
        &self.evidence
    }

    pub fn evidence_mut(&mut self) -> &mut EvidenceManager {
        &mut self.evidence
    }

    pub fn process_command(&mut self, cmd: Command, role: &Role) -> Result<(), KvError> {
        let result = self.execute(&cmd, role);
        self.evidence.record(&cmd.session_id, &cmd.action, &result);
        result
    }

    fn execute(&mut self, cmd: &Command, role: &Role) -> Result<(), KvError> {
        let session = self
            .sessions
            .validate_and_bind(&cmd.session_id, &cmd.client_id)?;

        check_permission(role, &cmd.action)?;

        let expected_sequence = session
            .sequence()
            .checked_add(1)
            .ok_or(KvError::SequenceError)?;

        if cmd.sequence != expected_sequence {
            return Err(KvError::SequenceError);
        }

        let updated_sequence = self.sessions.increment_sequence(&cmd.session_id)?;
        debug_assert_eq!(updated_sequence, expected_sequence);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::evidence::EvidenceStatus;
    use crate::session::Session;

    fn setup() -> (CommandProcessor, Session) {
        let mut sessions = SessionManager::new(Duration::from_secs(60));
        let session = sessions.create_session("client-1");

        (CommandProcessor::new(sessions), session)
    }

    fn command(session: &Session, sequence: u64, action: Action) -> Command {
        Command {
            session_id: session.id().to_owned(),
            client_id: session.client_id().to_owned(),
            sequence,
            action,
        }
    }

    #[test]
    fn executes_valid_command_and_advances_sequence() {
        let (mut processor, session) = setup();

        let first = command(&session, 1, Action::ExecuteCommand);
        assert_eq!(processor.process_command(first, &Role::Operator), Ok(()));

        let second = command(&session, 2, Action::ReadStatus);
        assert_eq!(processor.process_command(second, &Role::Operator), Ok(()));

        let current = processor
            .session_manager_mut()
            .validate_and_bind(session.id(), "client-1")
            .unwrap();

        assert_eq!(current.sequence(), 2);
    }

    #[test]
    fn rejects_stale_or_replayed_sequence() {
        let (mut processor, session) = setup();

        let stale = command(&session, 0, Action::ReadStatus);
        assert_eq!(
            processor.process_command(stale, &Role::Admin),
            Err(KvError::SequenceError)
        );

        let valid = command(&session, 1, Action::ReadStatus);
        assert_eq!(processor.process_command(valid, &Role::Admin), Ok(()));

        let replay = command(&session, 1, Action::ReadStatus);
        assert_eq!(
            processor.process_command(replay, &Role::Admin),
            Err(KvError::SequenceError)
        );
    }

    #[test]
    fn rejects_skipped_ahead_sequence() {
        let (mut processor, session) = setup();

        let skipped = command(&session, 2, Action::ReadStatus);
        assert_eq!(
            processor.process_command(skipped, &Role::Admin),
            Err(KvError::SequenceError)
        );

        let valid = command(&session, 1, Action::ReadStatus);
        assert_eq!(processor.process_command(valid, &Role::Admin), Ok(()));
    }

    #[test]
    fn rejects_forbidden_action_without_advancing_sequence() {
        let (mut processor, session) = setup();

        let forbidden = command(&session, 1, Action::ExecuteCommand);
        assert_eq!(
            processor.process_command(forbidden, &Role::ReadOnly),
            Err(KvError::Forbidden)
        );

        let allowed = command(&session, 1, Action::ReadStatus);
        assert_eq!(processor.process_command(allowed, &Role::ReadOnly), Ok(()));
    }

    #[test]
    fn rejects_command_bound_to_another_client() {
        let (mut processor, session) = setup();

        let mut cmd = command(&session, 1, Action::ReadStatus);
        cmd.client_id = "client-2".to_owned();

        assert_eq!(
            processor.process_command(cmd, &Role::Admin),
            Err(KvError::ClientMismatch)
        );
    }

    #[test]
    fn records_denied_forbidden_command() {
        let (mut processor, session) = setup();

        let forbidden = command(&session, 1, Action::ExecuteCommand);
        let result = processor.process_command(forbidden, &Role::ReadOnly);

        assert_eq!(result, Err(KvError::Forbidden));

        let records = processor.evidence().records();
        assert_eq!(records.len(), 1);

        let record = &records[0];
        assert_eq!(record.session_id(), session.id());
        assert_eq!(record.action(), &Action::ExecuteCommand);
        assert_eq!(record.status(), &EvidenceStatus::Denied(KvError::Forbidden));
    }

    #[test]
    fn records_successful_and_rejected_commands() {
        let (mut processor, session) = setup();

        let stale = command(&session, 0, Action::ReadStatus);
        assert_eq!(
            processor.process_command(stale, &Role::Admin),
            Err(KvError::SequenceError)
        );

        let forbidden = command(&session, 1, Action::ExecuteCommand);
        assert_eq!(
            processor.process_command(forbidden, &Role::ReadOnly),
            Err(KvError::Forbidden)
        );

        let valid = command(&session, 1, Action::ReadStatus);
        assert_eq!(processor.process_command(valid, &Role::Admin), Ok(()));

        let records = processor.evidence().records();
        assert_eq!(records.len(), 3);
        assert_eq!(
            records[0].status(),
            &EvidenceStatus::Denied(KvError::SequenceError)
        );
        assert_eq!(
            records[1].status(),
            &EvidenceStatus::Denied(KvError::Forbidden)
        );
        assert_eq!(records[2].status(), &EvidenceStatus::Success);
    }
}

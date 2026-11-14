use crate::{
    auth::{Action, Role},
    command::{Command, CommandProcessor},
    evidence::EvidenceManager,
    session::{KvError, Session, SessionManager},
    transport::Transport,
};

pub struct KvpEngine {
    processor: CommandProcessor,
    transport: Box<dyn Transport>,
}

impl KvpEngine {
    pub fn new(sessions: SessionManager, transport: Box<dyn Transport>) -> Self {
        Self {
            processor: CommandProcessor::new(sessions),
            transport,
        }
    }

    pub fn execute_action(
        &mut self,
        session_id: &str,
        client_id: &str,
        role: &Role,
        action: Action,
    ) -> Result<(), KvError> {
        let session = self
            .processor
            .session_manager_mut()
            .validate_and_bind(session_id, client_id)?;

        let sequence = session
            .sequence()
            .checked_add(1)
            .ok_or(KvError::SequenceError)?;

        let command = Command {
            session_id: session_id.to_owned(),
            client_id: client_id.to_owned(),
            sequence,
            action,
        };

        self.processor.process_command(command.clone(), role)?;

        let response = futures::executor::block_on(self.transport.execute(command))?;
        response.into_result()
    }

    pub fn create_session(&mut self, client_id: &str) -> Session {
        self.processor.session_manager_mut().create_session(client_id)
    }

    pub fn session_manager(&self) -> &SessionManager {
        self.processor.session_manager()
    }

    pub fn session_manager_mut(&mut self) -> &mut SessionManager {
        self.processor.session_manager_mut()
    }

    pub fn evidence(&self) -> &EvidenceManager {
        self.processor.evidence()
    }

    pub fn evidence_mut(&mut self) -> &mut EvidenceManager {
        self.processor.evidence_mut()
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::mock_transport::MockTransport;

    fn engine() -> (KvpEngine, MockTransport) {
        let mock = MockTransport::new();
        let observer = mock.clone();
        let sessions = SessionManager::new(Duration::from_secs(60));

        (KvpEngine::new(sessions, Box::new(mock)), observer)
    }

    #[test]
    fn executes_action_and_sends_command_to_transport() {
        let (mut engine, observer) = engine();
        let session = engine.create_session("client-1");

        let result = engine.execute_action(
            session.id(),
            "client-1",
            &Role::Admin,
            Action::ExecuteCommand,
        );

        assert_eq!(result, Ok(()));
        assert_eq!(
            observer.received_commands(),
            vec![Command {
                session_id: session.id().to_owned(),
                client_id: "client-1".to_owned(),
                sequence: 1,
                action: Action::ExecuteCommand,
            }]
        );
    }

    #[test]
    fn increments_sequence_for_each_successful_action() {
        let (mut engine, observer) = engine();
        let session = engine.create_session("client-1");

        engine
            .execute_action(session.id(), "client-1", &Role::Admin, Action::ReadStatus)
            .unwrap();
        engine
            .execute_action(session.id(), "client-1", &Role::Admin, Action::ReadStatus)
            .unwrap();

        let sequences: Vec<u64> = observer
            .received_commands()
            .into_iter()
            .map(|command| command.sequence)
            .collect();

        assert_eq!(sequences, vec![1, 2]);
    }

    #[test]
    fn does_not_send_forbidden_action_to_transport() {
        let (mut engine, observer) = engine();
        let session = engine.create_session("client-1");

        let result = engine.execute_action(
            session.id(),
            "client-1",
            &Role::ReadOnly,
            Action::ExecuteCommand,
        );

        assert_eq!(result, Err(KvError::Forbidden));
        assert!(observer.received_commands().is_empty());
    }
}

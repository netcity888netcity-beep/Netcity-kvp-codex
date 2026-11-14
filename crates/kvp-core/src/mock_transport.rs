use std::sync::{Arc, Mutex};

use crate::{
    auth::Action,
    command::Command,
    session::KvError,
    transport::{CommandResponse, Transport, TransportFuture},
};

#[derive(Clone, Debug)]
pub struct MockTransport {
    received: Arc<Mutex<Vec<Command>>>,
    outcome: Result<CommandResponse, KvError>,
}

impl Default for MockTransport {
    fn default() -> Self {
        Self {
            received: Arc::new(Mutex::new(Vec::new())),
            outcome: Ok(CommandResponse::success()),
        }
    }
}

impl MockTransport {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_error(error: KvError) -> Self {
        Self {
            outcome: Err(error),
            ..Self::default()
        }
    }

    pub fn with_response(response: CommandResponse) -> Self {
        Self {
            outcome: Ok(response),
            ..Self::default()
        }
    }

    pub fn received_commands(&self) -> Vec<Command> {
        self.received
            .lock()
            .expect("mock transport lock poisoned")
            .clone()
    }
}

impl Transport for MockTransport {
    fn execute<'a>(&'a self, command: Command) -> TransportFuture<'a> {
        self.received
            .lock()
            .expect("mock transport lock poisoned")
            .push(command);

        let outcome = self.outcome.clone();
        Box::pin(async move { outcome })
    }
}

pub struct KvpClient {
    transport: Box<dyn Transport>,
}

impl KvpClient {
    pub fn new(transport: Box<dyn Transport>) -> Self {
        Self { transport }
    }

    pub fn send_command(
        &self,
        session_id: String,
        client_id: String,
        sequence: u64,
        action: Action,
    ) -> Result<(), KvError> {
        let command = Command {
            session_id,
            client_id,
            sequence,
            action,
        };

        let response = futures::executor::block_on(self.transport.execute(command))?;
        response.into_result()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command() -> Command {
        Command {
            session_id: "session-1".to_owned(),
            client_id: "client-1".to_owned(),
            sequence: 7,
            action: Action::ExecuteCommand,
        }
    }

    #[test]
    fn sends_command_through_transport() {
        let mock = MockTransport::new();
        let observer = mock.clone();
        let client = KvpClient::new(Box::new(mock));

        let result = client.send_command(
            "session-1".to_owned(),
            "client-1".to_owned(),
            7,
            Action::ExecuteCommand,
        );

        assert_eq!(result, Ok(()));
        assert_eq!(observer.received_commands(), vec![command()]);
    }

    #[test]
    fn propagates_configured_transport_error() {
        let error = KvError::TransportError("transport offline".to_owned());
        let client = KvpClient::new(Box::new(MockTransport::with_error(error.clone())));

        let result = client.send_command(
            "session-1".to_owned(),
            "client-1".to_owned(),
            1,
            Action::ReadStatus,
        );

        assert_eq!(result, Err(error));
    }

    #[test]
    fn maps_failed_response_to_transport_error() {
        let client = KvpClient::new(Box::new(MockTransport::with_response(
            CommandResponse::failure("command rejected"),
        )));

        let result = client.send_command(
            "session-1".to_owned(),
            "client-1".to_owned(),
            1,
            Action::ReadStatus,
        );

        assert_eq!(
            result,
            Err(KvError::TransportError("command rejected".to_owned()))
        );
    }
}

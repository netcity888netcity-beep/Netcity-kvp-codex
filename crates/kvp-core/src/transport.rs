use std::future::Future;

use crate::command::Command;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandResponse {
    pub status: bool,
    pub error_message: String,
}

impl CommandResponse {
    pub fn success() -> Self {
        Self {
            status: true,
            error_message: String::new(),
        }
    }

    pub fn failure(error_message: impl Into<String>) -> Self {
        Self {
            status: false,
            error_message: error_message.into(),
        }
    }
}

pub trait Transport: Send + Sync {
    type Error: std::error::Error + Send + Sync + 'static;

    fn execute<'a>(
        &'a self,
        command: Command,
    ) -> impl Future<Output = Result<CommandResponse, Self::Error>> + Send + 'a;
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::future::ready;

    use super::*;
    use crate::auth::Action;

    struct MockTransport;

    impl Transport for MockTransport {
        type Error = Infallible;

        fn execute<'a>(
            &'a self,
            _command: Command,
        ) -> impl Future<Output = Result<CommandResponse, Self::Error>> + Send + 'a {
            ready(Ok(CommandResponse::success()))
        }
    }

    fn command() -> Command {
        Command {
            session_id: "session-1".to_owned(),
            client_id: "client-1".to_owned(),
            sequence: 1,
            action: Action::ReadStatus,
        }
    }

    #[test]
    fn response_helpers_build_expected_values() {
        assert_eq!(
            CommandResponse::success(),
            CommandResponse {
                status: true,
                error_message: String::new(),
            }
        );
        assert_eq!(
            CommandResponse::failure("forbidden"),
            CommandResponse {
                status: false,
                error_message: "forbidden".to_owned(),
            }
        );
    }

    #[test]
    fn transport_trait_can_be_implemented() {
        let transport = MockTransport;
        let _future = transport.execute(command());
    }
}

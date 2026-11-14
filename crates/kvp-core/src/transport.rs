use std::{future::Future, pin::Pin};

use crate::{command::Command, session::KvError};

pub type TransportFuture<'a> =
    Pin<Box<dyn Future<Output = Result<CommandResponse, KvError>> + Send + 'a>>;

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

    pub fn into_result(self) -> Result<(), KvError> {
        if self.status {
            Ok(())
        } else {
            Err(KvError::TransportError(self.error_message))
        }
    }
}

pub trait Transport: Send + Sync {
    fn execute<'a>(&'a self, command: Command) -> TransportFuture<'a>;
}

#[cfg(test)]
mod tests {
    use super::*;

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
}

use std::time::Duration;

use kvp_core::auth::{Action, Role};
use kvp_core::command::{Command, CommandProcessor};
use kvp_core::evidence::EvidenceStatus;
use kvp_core::session::SessionManager;

fn command(
    session_id: &str,
    client_id: &str,
    sequence: u64,
    action: Action,
) -> Command {
    Command {
        session_id: session_id.to_owned(),
        client_id: client_id.to_owned(),
        sequence,
        action,
    }
}

fn main() {
    println!("=== KVP Protocol Demo ===");

    let mut sessions = SessionManager::new(Duration::from_secs(300));
    let session = sessions.create_session("client-alpha");
    let mut processor = CommandProcessor::new(sessions);

    println!(
        "Created session {} for client '{}' with TTL 300s",
        session.id(),
        session.client_id()
    );

    println!("\n[1] Legitimate command: Operator / ExecuteCommand / sequence 1");
    let result = processor.process_command(
        command(session.id(), "client-alpha", 1, Action::ExecuteCommand),
        &Role::Operator,
    );
    println!("Result: {:?}", result);

    println!("\n[2] Replay attack: same sequence 1 is sent again");
    let result = processor.process_command(
        command(session.id(), "client-alpha", 1, Action::ExecuteCommand),
        &Role::Operator,
    );
    println!("Result: {:?}", result);

    println!("\n[3] Privilege violation: ReadOnly / CreateFleet / sequence 2");
    let result = processor.process_command(
        command(session.id(), "client-alpha", 2, Action::CreateFleet),
        &Role::ReadOnly,
    );
    println!("Result: {:?}", result);

    println!("\n[4] Client substitution: client-alpha session used by client-beta");
    let result = processor.process_command(
        command(session.id(), "client-beta", 2, Action::ReadStatus),
        &Role::Admin,
    );
    println!("Result: {:?}", result);

    println!("\n=== Evidence Log ===");

    for (index, record) in processor.evidence().records().iter().enumerate() {
        let status = match record.status() {
            EvidenceStatus::Success => "Success".to_owned(),
            EvidenceStatus::Denied(error) => format!("Denied({:?})", error),
        };

        println!(
            "{}. command_id={} session_id={} action={:?} status={} timestamp={}",
            index + 1,
            record.command_id(),
            record.session_id(),
            record.action(),
            status,
            record.timestamp()
        );
    }

    let current = processor
        .session_manager_mut()
        .validate_and_bind(session.id(), "client-alpha")
        .expect("session should still be active");

    println!(
        "\nEvidence records: {} | Final session sequence: {}",
        processor.evidence().len(),
        current.sequence()
    );
}

use crate::session::KvError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Admin,
    Operator,
    ReadOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    CreateFleet,
    ExecuteCommand,
    ReadStatus,
}

pub fn check_permission(role: &Role, action: &Action) -> Result<(), KvError> {
    let allowed = match (role, action) {
        (Role::Admin, _) => true,
        (Role::Operator, Action::ExecuteCommand | Action::ReadStatus) => true,
        (Role::ReadOnly, Action::ReadStatus) => true,
        _ => false,
    };

    if allowed {
        Ok(())
    } else {
        Err(KvError::Forbidden)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROLES: [Role; 3] = [Role::Admin, Role::Operator, Role::ReadOnly];
    const ACTIONS: [Action; 3] = [
        Action::CreateFleet,
        Action::ExecuteCommand,
        Action::ReadStatus,
    ];

    #[test]
    fn admin_can_perform_every_action() {
        for action in ACTIONS {
            assert_eq!(check_permission(&Role::Admin, &action), Ok(()));
        }
    }

    #[test]
    fn operator_policy_is_enforced() {
        assert_eq!(
            check_permission(&Role::Operator, &Action::CreateFleet),
            Err(KvError::Forbidden)
        );
        assert_eq!(
            check_permission(&Role::Operator, &Action::ExecuteCommand),
            Ok(())
        );
        assert_eq!(
            check_permission(&Role::Operator, &Action::ReadStatus),
            Ok(())
        );
    }

    #[test]
    fn read_only_policy_is_enforced() {
        assert_eq!(
            check_permission(&Role::ReadOnly, &Action::CreateFleet),
            Err(KvError::Forbidden)
        );
        assert_eq!(
            check_permission(&Role::ReadOnly, &Action::ExecuteCommand),
            Err(KvError::Forbidden)
        );
        assert_eq!(
            check_permission(&Role::ReadOnly, &Action::ReadStatus),
            Ok(())
        );
    }

    #[test]
    fn all_role_action_combinations_match_policy() {
        for role in ROLES {
            for action in ACTIONS {
                let expected = match (&role, &action) {
                    (Role::Admin, _) => Ok(()),
                    (Role::Operator, Action::ExecuteCommand | Action::ReadStatus) => Ok(()),
                    (Role::ReadOnly, Action::ReadStatus) => Ok(()),
                    _ => Err(KvError::Forbidden),
                };

                assert_eq!(
                    check_permission(&role, &action),
                    expected,
                    "unexpected policy result for role={role:?}, action={action:?}"
                );
            }
        }
    }
}

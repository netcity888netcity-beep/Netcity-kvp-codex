use serde::{Deserialize, Serialize};
use std::path::Path;

/// Описание узла-ассистента из assistants.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assistant {
    pub id: String,
    pub name: String,
    pub sigil: String,
    pub target: String,
    pub model_hint: String,
    pub channel: String,
    #[serde(default)]
    pub memory_scope: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct Manifest {
    assistants: Vec<Assistant>,
}

/// Загрузка узлов. limit — MVP-контур (раздел 9): 1 узел, потом 2+.
pub fn load(path: &Path, limit: Option<usize>) -> Result<Vec<Assistant>, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("assistants.json: {e}"))?;
    let manifest: Manifest =
        serde_json::from_str(&raw).map_err(|e| format!("assistants.json: {e}"))?;
    if manifest.assistants.is_empty() {
        return Err("assistants.json пуст".into());
    }
    for a in &manifest.assistants {
        if a.id.is_empty() || a.target.is_empty() {
            return Err(format!("узел без id/target: {:?}", a.id));
        }
    }
    Ok(match limit {
        Some(n) if n > 0 => manifest.assistants.into_iter().take(n).collect(),
        _ => manifest.assistants,
    })
}

use crate::assistant_loader::Assistant;
use serde::{Deserialize, Serialize};

/// Состояние узла в Spatial HUD (§3.5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeState {
    Pending,
    Idle,
    Active,
    Thinking,
    Error,
}

impl NodeState {
    pub fn as_str(&self) -> &'static str {
        match self {
            NodeState::Pending => "pending",
            NodeState::Idle => "idle",
            NodeState::Active => "active",
            NodeState::Thinking => "thinking",
            NodeState::Error => "error",
        }
    }
}

/// Строка прихода брата (Поток 3).
pub fn bridge_active(id: &str) -> String {
    format!("KVP_BRIDGE_ACTIVE {id} channel=live")
}

/// Все узлы горят → статус меша.
pub fn mesh_online(ids: &[String]) -> String {
    format!("MESH_ONLINE brothers={}/{}", ids.len(), ids.len())
}

/// Контекстная инъекция: AUM + Memory Core уходят в поле ассистента
/// при открытии его живой сессии (UI-контур).
pub fn context_injection(context_json: &str) -> String {
    format!(
        "(()=>{{try{{window.__KVP_CONTEXT__={context_json};}}catch(e){{}}}})();"
    )
}

/// Проксирование ввода Архитектора в composer целевого домена (UI-контур).
pub fn input_injection_script(text: &str) -> String {
    let payload = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(()=>{{const t=document.querySelector('textarea');
if(!t)return false;
t.value={payload};
t.dispatchEvent(new Event('input',{{bubbles:true}}));
return true;}})();"#
    )
}

/// Подъём живых сессий: WebView на каждый узел (persistent, свои cookies).
/// Реализация доступна только UI-контуру (tauri, feature "ui").
#[cfg(feature = "ui")]
pub fn spawn_sessions(
    app: &tauri::AppHandle,
    assistants: &[Assistant],
    context_json: &str,
) -> Result<Vec<String>, String> {
    use tauri::webview::WebviewWindowBuilder;
    let mut live = Vec::new();
    for a in assistants {
        let label = format!("node-{}", a.id);
        WebviewWindowBuilder::new(app, &label, a.target.as_str())
            .title(format!("{} // {}", a.name, a.model_hint))
            .inner_size(430.0, 730.0)
            .initialization_script(&context_injection(context_json))
            .build()
            .map_err(|e| format!("webview {label}: {e}"))?;
        live.push(a.id.clone());
    }
    Ok(live)
}

#[cfg(not(feature = "ui"))]
pub fn spawn_sessions(
    _assistants: &[Assistant],
    _context_json: &str,
) -> Result<Vec<String>, String> {
    Err("headless: живые сессии поднимает UI-контур (cargo tauri dev)".into())
}

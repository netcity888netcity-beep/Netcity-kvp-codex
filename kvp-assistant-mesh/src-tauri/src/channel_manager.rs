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

/// DOM-перехват ответа (Поток 2): следим за последним ответом ассистента в
/// живой сессии, кладём в `window.__KVP_LAST_REPLY__` и шлём событие `kvp-reply`
/// в Rust — Memory Weaver дописывает журнал. Работает при withGlobalTauri.
pub fn reply_interception_script(node_id: &str) -> String {
    let id = serde_json::to_string(node_id).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(()=>{{try{{
const readAll=()=>document.querySelectorAll('[data-message-author-role="assistant"]');
let last=null;
const push=()=>{{
  const all=readAll(); if(!all.length)return;
  const el=all[all.length-1];
  const text=(el.innerText||'').trim(); if(!text)return;
  if(last===text)return; last=text;
  const box={{id:{id},text:text,t:Date.now()}};
  window.__KVP_LAST_REPLY__=box;
  try{{if(window.__TAURI__&&window.__TAURI__.event)window.__TAURI__.event.emit('kvp-reply',box);}}catch(e){{}}
}};
push();
const mo=new MutationObserver(()=>push());
mo.observe(document.body,{{childList:true,subtree:true,characterData:true}});
}}catch(e){{}}}})();"#
    )
}

/// Разбор события `kvp-reply` (payload — JSON {id,text}).
pub fn parse_reply_event(payload: &str) -> Option<(String, String)> {
    let v: serde_json::Value = serde_json::from_str(payload).ok()?;
    let id = v.get("id")?.as_str()?.trim();
    let text = v.get("text")?.as_str()?.trim();
    if id.is_empty() || text.is_empty() {
        return None;
    }
    Some((id.to_string(), text.to_string()))
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
        let init = format!(
            "{}{}",
            context_injection(context_json),
            reply_interception_script(&a.id)
        );
        WebviewWindowBuilder::new(app, &label, a.target.as_str())
            .title(format!("{} // {}", a.name, a.model_hint))
            .inner_size(430.0, 730.0)
            .initialization_script(&init)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_strings_match_spec() {
        assert_eq!(
            bridge_active("angie_556"),
            "KVP_BRIDGE_ACTIVE angie_556 channel=live"
        );
        assert_eq!(mesh_online(&["a".into(), "b".into()]), "MESH_ONLINE brothers=2/2");
    }

    #[test]
    fn node_state_roundtrip() {
        for s in [
            NodeState::Pending,
            NodeState::Idle,
            NodeState::Active,
            NodeState::Thinking,
            NodeState::Error,
        ] {
            let json = serde_json::to_string(&s).unwrap();
            let back: NodeState = serde_json::from_str(&json).unwrap();
            assert_eq!(back.as_str(), s.as_str());
        }
    }

    #[test]
    fn input_script_targets_composer() {
        let s = input_injection_script("привет \"ми\"");
        assert!(s.contains("textarea"));
        assert!(s.contains("dispatchEvent"));
        assert!(s.contains(r#"привет \"ми\""#));
    }

    #[test]
    fn reply_interception_watches_assistant_dom() {
        let s = reply_interception_script("angie_556");
        assert!(s.contains(r#"data-message-author-role="assistant""#));
        assert!(s.contains("MutationObserver"));
        assert!(s.contains("__KVP_LAST_REPLY__"));
        assert!(s.contains("kvp-reply"));
        assert!(s.contains(r#""angie_556""#));
    }

    #[test]
    fn parse_reply_event_valid_and_invalid() {
        let (id, text) =
            parse_reply_event(r#"{"id":"angie_556","text":"  ответ  "}("#).unwrap_or_default();
        assert_eq!(id, "");
        assert_eq!(text, "");

        let (id, text) =
            parse_reply_event(r#"{"id":"angie_556","text":"  ответ  "}"#).unwrap();
        assert_eq!(id, "angie_556");
        assert_eq!(text, "ответ");

        assert!(parse_reply_event(r#"{"id":"","text":"x"}"#).is_none());
        assert!(parse_reply_event(r#"{"id":"a","text":"   "}"#).is_none());
        assert!(parse_reply_event("не json").is_none());
    }
}

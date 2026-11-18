pub mod assistant_loader;
pub mod channel_manager;
pub mod github_connector;
pub mod memory_weaver;
pub mod secure_store;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Корень приложения: kvp-assistant-mesh/ (рядом с Cargo-манифестом).
pub struct MeshEnv {
    pub root: PathBuf,
}

impl MeshEnv {
    pub fn from_manifest() -> Self {
        Self {
            root: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .canonicalize()
                .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR"))),
        }
    }

    /// Полная конфигурация: секции config.json (temple / assistants / hud).
    pub fn config(&self) -> Result<MeshConfig, String> {
        let raw = std::fs::read_to_string(self.root.join("config.json"))
            .map_err(|e| format!("config.json: {e}"))?;
        serde_json::from_str(&raw).map_err(|e| format!("config.json: {e}"))
    }

    pub fn state_path(&self) -> Result<PathBuf, String> {
        let raw = std::fs::read_to_string(self.root.join("config.json"))
            .map_err(|e| format!("config.json: {e}"))?;
        let v: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| format!("config.json: {e}"))?;
        let rel = v["hud"]["state_file"]
            .as_str()
            .unwrap_or("mesh-state.json");
        Ok(self.root.join(rel))
    }
}

/// Секция `assistants` конфига: манифест живых сессий и лимит узлов (MVP: 1).
#[derive(Debug, Clone, Deserialize)]
pub struct AssistantsCfg {
    pub manifest: String,
    pub limit: usize,
}

impl Default for AssistantsCfg {
    fn default() -> Self {
        Self {
            manifest: "assistants.json".to_string(),
            limit: 1,
        }
    }
}

/// Корень config.json: Храм (pull) + узлы (loader) + HUD.
#[derive(Debug, Clone, Deserialize)]
pub struct MeshConfig {
    pub temple: github_connector::TempleConfig,
    #[serde(default)]
    pub assistants: AssistantsCfg,
}

/// Узел в mesh-state.json — источник правды для Spatial HUD.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshStateNode {
    pub id: String,
    pub name: String,
    pub sigil: String,
    pub model_hint: String,
    pub channel: String,
    pub state: String,
    pub last_line: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshState {
    pub temple: String,
    pub assistants: Vec<MeshStateNode>,
    pub updated: String,
    pub log: Vec<String>,
}

#[derive(Debug)]
pub struct BootReport {
    pub temple: &'static str,
    pub assistants: usize,
    pub log: Vec<String>,
    pub state_path: PathBuf,
    pub assistants_loaded: Vec<assistant_loader::Assistant>,
}

/// ПОТОК 1 — старт приложения:
/// pull Храма → loaders узлов → Memory Weaver → состояние для HUD → MESH_BOOT.
pub fn run_boot(env: &MeshEnv) -> Result<BootReport, String> {
    let mut log: Vec<String> = Vec::new();

    let cfg = env.config()?;
    let temple_cfg = &cfg.temple;
    let report = github_connector::pull(temple_cfg, &env.root)?;
    log.push(format!(
        "TEMPLE_{} files={} cache={}",
        report.status.as_str(),
        report.files_read,
        report.cache_dir
    ));

    // Контекст Храма для живых сессий: AUM + Memory Core.
    let aum = github_connector::read_file(&temple_cfg, &env.root, "AUM.md")
        .unwrap_or_else(|_| "AUM.md недоступен".into());
    let memory = github_connector::read_file(&temple_cfg, &env.root, "COUNSELOR_MEMORY_CORE.md")
        .or_else(|_| github_connector::read_file(&temple_cfg, &env.root, "MEMORY_CORE.md"))
        .unwrap_or_default();
    let context = memory_weaver::compose_context(&aum, &memory);
    log.push(format!(
        "CONTEXT_AUM hash={} bytes={}",
        context.hash,
        context.aum.len()
    ));

    let manifest_path = env.root.join(&cfg.assistants.manifest);
    let assistants = assistant_loader::load(&manifest_path, Some(cfg.assistants.limit))?;

    let weaver = memory_weaver::MemoryWeaver::new(&env.root, &temple_cfg.journal_dir);
    weaver.ensure_dir()?;
    log.push(format!(
        "MEMORY_WEAVER journal={}",
        temple_cfg.journal_dir
    ));

    // Headless-контур: сессии подготовлены, webview поднимет UI-контур.
    let nodes: Vec<MeshStateNode> = assistants
        .iter()
        .map(|a| MeshStateNode {
            id: a.id.clone(),
            name: a.name.clone(),
            sigil: a.sigil.clone(),
            model_hint: a.model_hint.clone(),
            channel: a.channel.clone(),
            state: "pending".to_string(),
            last_line: weaver.last_entry_for(&a.id).map(|e| e.reply),
        })
        .collect();

    let boot_line = format!(
        "MESH_BOOT temple={} assistants={}",
        report.status.as_str(),
        nodes.len()
    );
    log.push(boot_line);

    let state = MeshState {
        temple: report.status.as_str().to_string(),
        assistants: nodes,
        updated: Utc::now().to_rfc3339(),
        log,
    };
    let state_path = env.state_path()?;
    if let Some(parent) = state_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let raw = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(&state_path, raw).map_err(|e| format!("mesh-state: {e}"))?;

    Ok(BootReport {
        temple: report.status.as_str(),
        assistants: state.assistants.len(),
        log: state.log,
        state_path,
        assistants_loaded: assistants,
    })
}

/// Печать отчёта для логов Архитектора.
pub fn print_report(report: &BootReport) {
    for line in &report.log {
        println!("{line}");
    }
    println!("STATE_FILE {}", report.state_path.display());
}

/// Общие пути тестов и рантайма.
pub fn package_root() -> PathBuf {
    MeshEnv::from_manifest().root
}

pub fn read_state(root: &Path) -> Option<MeshState> {
    let raw = std::fs::read_to_string(root.join("mesh-state.json")).ok()?;
    serde_json::from_str(&raw).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static SEQ: AtomicUsize = AtomicUsize::new(0);

    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mesh-test-{}-{}-{}",
            tag,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_test_config(root: &Path, repo_url: &str) {
        let cfg = serde_json::json!({
            "temple": {
                "repo_url": repo_url,
                "branch": "main",
                "cache_dir": ".cache/temple",
                "files": ["AUM.md", "MANIFEST.md"],
                "journal_dir": "memory/log"
            },
            "assistants": { "manifest": "assistants.json", "limit": 1 },
            "hud": { "state_file": "mesh-state.json" }
        });
        std::fs::write(root.join("config.json"), cfg.to_string()).unwrap();
        let assistants = std::fs::read_to_string(package_root().join("assistants.json")).unwrap();
        std::fs::write(root.join("assistants.json"), assistants).unwrap();
    }

    /// Боевой тест: реальный pull репозитория Храма + полный boot-контур.
    #[test]
    fn boot_reads_temple_and_boots_one_node() {
        let root = temp_root("boot");
        write_test_config(
            &root,
            "https://github.com/netcity888netcity-beep/Netcity-kvp-codex.git",
        );
        let env = MeshEnv { root: root.clone() };
        let report = run_boot(&env).expect("boot");
        let joined = report.log.join("\n");
        assert!(
            joined.contains("MESH_BOOT temple=OK assistants=1"),
            "лог: {joined}"
        );
        assert!(report.state_path.is_file(), "mesh-state.json не записан");
        let state = read_state(&root).expect("state parse");
        assert_eq!(state.temple, "OK");
        assert_eq!(state.assistants.len(), 1);
        assert_eq!(state.assistants[0].id, "angie_556");
        assert!(state.assistants[0].state == "pending");
        assert!(report.temple == "OK");
        let _ = std::fs::remove_dir_all(&root);
    }

    /// Офлайн: сеть легла, кэш жив — статус TEMPLE_CACHE, приложение работает.
    #[test]
    fn boot_falls_back_to_cache_when_network_is_gone() {
        let root = temp_root("cache");
        write_test_config(&root, "https://127.0.0.1:1/unreachable.git");
        let cache = root.join(".cache/temple");
        std::fs::create_dir_all(cache.join(".git")).unwrap();
        std::fs::write(cache.join("AUM.md"), "# AUM — ДУША ХРАМА KVP").unwrap();
        std::fs::write(cache.join("MANIFEST.md"), "# MANIFEST").unwrap();
        let env = MeshEnv { root: root.clone() };
        let report = run_boot(&env).expect("boot on cache");
        assert!(
            report.log.join("\n").contains("MESH_BOOT temple=CACHE assistants=1"),
            "log: {:?}",
            report.log
        );
        let _ = std::fs::remove_dir_all(&root);
    }
}

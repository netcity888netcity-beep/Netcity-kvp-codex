use std::path::{Path, PathBuf};

/// Secure Store — сессии и токены только в защищённом хранилище ОС.
/// Здесь: платформенный файл с правами 0600 (unix). В UI-контуре поверх —
/// системный keychain/stronghold ОС. В коде, логах и git — НИКОГДА не пишем
/// значения секретов: только «есть/нет».
pub struct SecureStore {
    file: PathBuf,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct StoreFile {
    entries: std::collections::BTreeMap<String, String>,
}

impl SecureStore {
    pub fn open(root: &Path) -> Result<Self, String> {
        let dir = root.join(".cache").join("secure");
        std::fs::create_dir_all(&dir).map_err(|e| format!("secure dir: {e}"))?;
        Ok(Self {
            file: dir.join("store.json"),
        })
    }

    fn load(&self) -> StoreFile {
        std::fs::read_to_string(&self.file)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or(StoreFile {
                entries: Default::default(),
            })
    }

    fn save(&self, store: &StoreFile) -> Result<(), String> {
        let raw = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
        std::fs::write(&self.file, raw).map_err(|e| format!("secure write: {e}"))?;
        harden(&self.file);
        Ok(())
    }

    pub fn put(&self, key: &str, value: &str) -> Result<(), String> {
        let mut store = self.load();
        store.entries.insert(key.to_string(), value.to_string());
        self.save(&store)
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.load().entries.get(key).cloned()
    }

    /// Существует ли секрет — без выдачи значения (для логов HUD).
    pub fn has(&self, key: &str) -> bool {
        self.load().entries.contains_key(key)
    }

    pub fn remove(&self, key: &str) -> Result<(), String> {
        let mut store = self.load();
        store.entries.remove(key);
        self.save(&store)
    }
}

#[cfg(unix)]
fn harden(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
}

#[cfg(not(unix))]
fn harden(_path: &Path) {}

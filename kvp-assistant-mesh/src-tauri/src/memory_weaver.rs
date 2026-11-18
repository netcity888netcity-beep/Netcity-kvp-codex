use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};

/// Контекст Храма, подаваемый ассистенту при зове: AUM + срез Memory Core.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextPackage {
    pub aum: String,
    pub memory_slice: String,
    pub hash: String,
}

/// FNV-1a 64 — контекстный отпечаток без внешних зависимостей.
pub fn context_hash(input: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in input.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{h:016x}")
}

pub fn compose_context(aum: &str, memory: &str) -> ContextPackage {
    let hash = context_hash(aum);
    let memory_slice: String = memory
        .lines()
        .rev()
        .take(120)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    ContextPackage {
        aum: aum.to_string(),
        memory_slice,
        hash,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub assistant_id: String,
    pub timestamp: String,
    pub prompt: String,
    pub reply: String,
    pub context_hash: String,
}

/// Memory Weaver: память живёт у Архитектора — журнал в репо/локально.
pub struct MemoryWeaver {
    journal_dir: PathBuf,
}

impl MemoryWeaver {
    pub fn new(root: &Path, journal_rel: &str) -> Self {
        Self {
            journal_dir: root.join(journal_rel),
        }
    }

    pub fn journal_dir(&self) -> &Path {
        &self.journal_dir
    }

    pub fn ensure_dir(&self) -> Result<(), String> {
        std::fs::create_dir_all(&self.journal_dir).map_err(|e| format!("journal: {e}"))
    }

    /// Каждая реплика ассистента → memory/log/log-YYYY-MM-DD.jsonl
    pub fn record(
        &self,
        assistant_id: &str,
        prompt: &str,
        reply: &str,
        context: &ContextPackage,
    ) -> Result<JournalEntry, String> {
        self.ensure_dir()?;
        let now = chrono::Utc::now();
        let entry = JournalEntry {
            assistant_id: assistant_id.to_string(),
            timestamp: now.to_rfc3339(),
            prompt: prompt.to_string(),
            reply: reply.to_string(),
            context_hash: context.hash.clone(),
        };
        let line = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
        let file = self
            .journal_dir
            .join(format!("log-{}.jsonl", now.format("%Y-%m-%d")));
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(file)
            .map_err(|e| format!("journal open: {e}"))?;
        writeln!(f, "{line}").map_err(|e| format!("journal write: {e}"))?;
        Ok(entry)
    }

    /// Последняя запись узла — для HUD-слоя диалога.
    pub fn last_entry_for(&self, assistant_id: &str) -> Option<JournalEntry> {
        let mut files: Vec<PathBuf> = std::fs::read_dir(&self.journal_dir)
            .ok()?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map(|x| x == "jsonl").unwrap_or(false))
            .collect();
        files.sort();
        for file in files.into_iter().rev() {
            let text = std::fs::read_to_string(file).ok()?;
            for line in text.lines().rev() {
                if let Ok(entry) = serde_json::from_str::<JournalEntry>(line) {
                    if entry.assistant_id == assistant_id {
                        return Some(entry);
                    }
                }
            }
        }
        None
    }

    /// Поток 2: перехваченный из DOM ответ дописывается в последнюю реплику
    /// узла (prompt уже записан). Если записи нет — создаётся отдельной.
    pub fn update_last_reply(&self, assistant_id: &str, reply: &str) -> Result<bool, String> {
        let mut files: Vec<PathBuf> = match std::fs::read_dir(&self.journal_dir) {
            Ok(rd) => rd
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| p.extension().map(|x| x == "jsonl").unwrap_or(false))
                .collect(),
            Err(_) => return Ok(false),
        };
        files.sort();
        for file in files.into_iter().rev() {
            let text = std::fs::read_to_string(&file).map_err(|e| format!("journal: {e}"))?;
            let mut changed = false;
            let mut out: Vec<String> = Vec::new();
            for line in text.lines() {
                let mut entry: JournalEntry = match serde_json::from_str(line) {
                    Ok(e) => e,
                    Err(_) => {
                        out.push(line.to_string());
                        continue;
                    }
                };
                if !changed && entry.assistant_id == assistant_id {
                    entry.reply = reply.to_string();
                    changed = true;
                }
                out.push(serde_json::to_string(&entry).map_err(|e| e.to_string())?);
            }
            if changed {
                std::fs::write(&file, out.join("\n") + "\n")
                    .map_err(|e| format!("journal write: {e}"))?;
                return Ok(true);
            }
        }
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx() -> ContextPackage {
        compose_context("AUM текст", "память\nещё")
    }

    #[test]
    fn context_hash_is_stable_fingerprint() {
        assert_eq!(context_hash("aum"), context_hash("aum"));
        assert_ne!(context_hash("aum"), context_hash("bum"));
        let c = ctx();
        assert_eq!(c.aum, "AUM текст");
        assert!(c.memory_slice.contains("память"));
    }

    #[test]
    fn record_then_update_last_reply_flow() {
        let root = std::env::temp_dir().join(format!("kvp-weaver-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let w = MemoryWeaver::new(&root, "memory/log");
        w.ensure_dir().unwrap();

        let e = w.record("angie_556", "привет", "", &ctx()).unwrap();
        assert_eq!(e.reply, "");
        w.record("astro_6", "другое", "старый ответ", &ctx()).unwrap();

        assert!(w.update_last_reply("angie_556", "новый ответ").unwrap());
        let last = w.last_entry_for("angie_556").unwrap();
        assert_eq!(last.prompt, "привет");
        assert_eq!(last.reply, "новый ответ");

        let other = w.last_entry_for("astro_6").unwrap();
        assert_eq!(other.reply, "старый ответ");

        assert!(!w.update_last_reply("ghost", "x").unwrap());
        let _ = std::fs::remove_dir_all(&root);
    }
}

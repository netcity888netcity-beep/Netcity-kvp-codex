use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Конфигурация Храма: откуда и что тянем (config.json → секция temple).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempleConfig {
    pub repo_url: String,
    #[serde(default = "default_branch")]
    pub branch: String,
    #[serde(default = "default_refresh")]
    pub refresh_minutes: u64,
    pub cache_dir: String,
    #[serde(default)]
    pub files: Vec<String>,
    #[serde(default = "default_journal")]
    pub journal_dir: String,
}

fn default_branch() -> String {
    "main".to_string()
}
fn default_refresh() -> u64 {
    30
}
fn default_journal() -> String {
    "memory/log".to_string()
}

/// Статус Храма для HUD: OK — свежая копия, CACHE — офлайн-кэш.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TempleStatus {
    #[serde(rename = "OK")]
    Ok,
    #[serde(rename = "CACHE")]
    Cache,
}

impl TempleStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TempleStatus::Ok => "OK",
            TempleStatus::Cache => "CACHE",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TempleReport {
    pub status: TempleStatus,
    pub files_read: usize,
    pub cache_dir: String,
    pub detail: String,
}

fn run_git(args: &[&str], cwd: Option<&Path>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let out = cmd
        .output()
        .map_err(|e| format!("git не запускается: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "git {:?} -> {}",
            args,
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Запрет выхода за пределы кэша: без абсолютных путей и "..".
pub fn safe_relpath(name: &str) -> Result<PathBuf, String> {
    let p = Path::new(name);
    if p.is_absolute() || name.split('/').any(|seg| seg == "..") || name.contains('\\') {
        return Err(format!("недопустимый путь в конфиге: {name}"));
    }
    Ok(p.to_path_buf())
}

/// Клонирование / обновление репозитория Храма в локальный кэш.
/// Используем системный git (встроенный TLS, ноль внешних сервисов);
/// git2 — запасной путь стека, требует OpenSSL-заголовков при сборке.
pub fn pull(config: &TempleConfig, root: &Path) -> Result<TempleReport, String> {
    let cache = root.join(&config.cache_dir);
    let have_cache = cache.join(".git").is_dir();

    let fresh = if !have_cache {
        if let Some(parent) = cache.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::remove_dir_all(&cache);
        run_git(
            &[
                "clone",
                "--depth",
                "1",
                "--branch",
                &config.branch,
                &config.repo_url,
                cache.to_str().ok_or("кэш: плохой путь")?,
            ],
            None,
        )
        .is_ok()
    } else {
        run_git(&["fetch", "--depth", "1", "origin", &config.branch], Some(&cache))
            .and_then(|_| {
                run_git(
                    &["reset", "--hard", &format!("origin/{}", config.branch)],
                    Some(&cache),
                )
            })
            .is_ok()
    };

    let files_read = count_readable(&config.files, &cache);
    if fresh {
        Ok(TempleReport {
            status: TempleStatus::Ok,
            files_read,
            cache_dir: config.cache_dir.clone(),
            detail: format!("git {} @ {}", config.branch, config.repo_url),
        })
    } else if have_cache && files_read > 0 {
        Ok(TempleReport {
            status: TempleStatus::Cache,
            files_read,
            cache_dir: config.cache_dir.clone(),
            detail: "сеть недоступна — работа на кэше Храма".into(),
        })
    } else {
        Err("нет ни сети, ни кэша Храма".into())
    }
}

fn count_readable(files: &[String], cache: &Path) -> usize {
    files
        .iter()
        .filter(|f| safe_relpath(f).map(|r| cache.join(r).is_file()).unwrap_or(false))
        .count()
}

/// Чтение файла Храма из кэша (после pull).
pub fn read_file(config: &TempleConfig, root: &Path, name: &str) -> Result<String, String> {
    let rel = safe_relpath(name)?;
    let path = root.join(&config.cache_dir).join(rel);
    std::fs::read_to_string(&path).map_err(|e| format!("чтение {name}: {e}"))
}

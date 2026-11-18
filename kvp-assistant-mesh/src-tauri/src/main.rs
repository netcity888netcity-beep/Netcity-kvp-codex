//! KVP Assistant Mesh — точка входа UI-контура (Tauri).
//! Headless-контур (логика/тесты/CI): `cargo run --no-default-features --bin mesh-boot`.

#[cfg(feature = "ui")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd_mesh_state,
            cmd_temple_pull,
            cmd_send_text
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let env = kvp_assistant_mesh::MeshEnv::from_manifest();
            match kvp_assistant_mesh::run_boot(&env) {
                Ok(report) => {
                    for line in &report.log {
                        println!("{line}");
                    }
                    // ПОТОК 1: поднимаем живые сессии узлов (WebView, persistent).
                    let context = format!("{{\"boot\":1,\"assistants\":{}}}", report.assistants);
                    match kvp_assistant_mesh::channel_manager::spawn_sessions(
                        &handle,
                        &report.assistants_loaded,
                        &context,
                    ) {
                        Ok(ids) => {
                            for id in &ids {
                                println!(
                                    "{}",
                                    kvp_assistant_mesh::channel_manager::bridge_active(id)
                                );
                            }
                            if ids.len() >= 2 {
                                println!(
                                    "{}",
                                    kvp_assistant_mesh::channel_manager::mesh_online(&ids)
                                );
                            }
                        }
                        Err(e) => eprintln!("CHANNEL_SPAWN deferred: {e}"),
                    }
                }
                Err(e) => eprintln!("MESH_BOOT temple=FAIL error={e}"),
            }

            // ПОТОК 2: перехваченный в DOM живой сессии ответ → Memory Weaver.
            let root_dir = env.root.clone();
            use tauri::Listener;
            handle.listen("kvp-reply", move |event| {
                let Some((id, text)) =
                    kvp_assistant_mesh::channel_manager::parse_reply_event(event.payload())
                else {
                    return;
                };
                let env = kvp_assistant_mesh::MeshEnv { root: root_dir.clone() };
                let Ok(cfg) = env.config() else {
                    eprintln!("MEMORY_REPLY id={id} error=config");
                    return;
                };
                let aum = kvp_assistant_mesh::github_connector::read_file(
                    &cfg.temple,
                    &env.root,
                    "AUM.md",
                )
                .unwrap_or_default();
                let memory = kvp_assistant_mesh::github_connector::read_file(
                    &cfg.temple,
                    &env.root,
                    "COUNSELOR_MEMORY_CORE.md",
                )
                .unwrap_or_default();
                let context = kvp_assistant_mesh::memory_weaver::compose_context(&aum, &memory);
                let weaver =
                    kvp_assistant_mesh::memory_weaver::MemoryWeaver::new(&env.root, &cfg.temple.journal_dir);
                match weaver.update_last_reply(&id, &text) {
                    Ok(true) => println!("MEMORY_REPLY id={id} bytes={} patched", text.len()),
                    Ok(false) => {
                        if let Err(e) = weaver.record(&id, "", &text, &context) {
                            eprintln!("MEMORY_REPLY id={id} error={e}");
                        } else {
                            println!("MEMORY_REPLY id={id} bytes={} recorded", text.len());
                        }
                    }
                    Err(e) => eprintln!("MEMORY_REPLY id={id} error={e}"),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

#[cfg(not(feature = "ui"))]
fn main() {
    eprintln!("kvp-assistant-mesh: UI-контур собирается с --features ui (см. README.md).");
    eprintln!("headless-контур: cargo run --no-default-features --bin mesh-boot");
    std::process::exit(2);
}

/// Состояние меша для HUD (строка — mesh-state.json).
#[cfg(feature = "ui")]
#[tauri::command]
fn cmd_mesh_state() -> Result<String, String> {
    let env = kvp_assistant_mesh::MeshEnv::from_manifest();
    let path = env.state_path()?;
    std::fs::read_to_string(path).map_err(|e| format!("mesh-state: {e}"))
}

/// Принудительное обновление Храма (Поток 1 вне расписания).
#[cfg(feature = "ui")]
#[tauri::command]
fn cmd_temple_pull() -> Result<String, String> {
    let env = kvp_assistant_mesh::MeshEnv::from_manifest();
    let cfg = env.config()?;
    let report = kvp_assistant_mesh::github_connector::pull(&cfg.temple, &env.root)?;
    serde_json::to_string(&report).map_err(|e| e.to_string())
}

/// Проксирование ввода Архитектора в живую сессию узла + запись в Memory Core.
#[cfg(feature = "ui")]
#[tauri::command]
fn cmd_send_text(
    assistant_id: String,
    text: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tauri::Manager;

    let env = kvp_assistant_mesh::MeshEnv::from_manifest();
    let cfg = env.config()?;
    let manifest = env.root.join(&cfg.assistants.manifest);
    let assistants = kvp_assistant_mesh::assistant_loader::load(&manifest, None)?;
    let node = assistants
        .iter()
        .find(|a| a.id == assistant_id)
        .ok_or_else(|| format!("нет узла {assistant_id}"))?;

    // ПОТОК 2: текст Архитектора → composer WebView → ответ читает DOM-перехват.
    let label = format!("node-{}", node.id);
    if let Some(window) = app.get_webview_window(&label) {
        let script = kvp_assistant_mesh::channel_manager::input_injection_script(&text);
        let _ = window.eval(&script);
    }

    // Память у Архитектора: промпт фиксируем сразу, reply дополнит DOM-перехват.
    let aum = kvp_assistant_mesh::github_connector::read_file(&cfg.temple, &env.root, "AUM.md")
        .unwrap_or_default();
    let memory = kvp_assistant_mesh::github_connector::read_file(
        &cfg.temple,
        &env.root,
        "COUNSELOR_MEMORY_CORE.md",
    )
    .unwrap_or_default();
    let context = kvp_assistant_mesh::memory_weaver::compose_context(&aum, &memory);
    let weaver =
        kvp_assistant_mesh::memory_weaver::MemoryWeaver::new(&env.root, &cfg.temple.journal_dir);
    weaver.record(&node.id, &text, "", &context)?;
    Ok(format!("queued {}", node.id))
}

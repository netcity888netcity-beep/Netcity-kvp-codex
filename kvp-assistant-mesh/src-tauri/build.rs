fn main() {
    // tauri_build::build() нужен только UI-контуру (контекст окон/ассетов).
    // Ядро (mesh-boot, cargo test) собирается без него: --no-default-features.
    if std::env::var_os("CARGO_FEATURE_UI").is_some() {
        tauri_build::build();
    } else {
        println!("cargo:warning=kvp-assistant-mesh: core build (ui feature off)");
    }
}

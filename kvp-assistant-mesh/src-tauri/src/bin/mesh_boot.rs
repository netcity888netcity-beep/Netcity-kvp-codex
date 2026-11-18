//! mesh-boot — headless-старт MVP-контура (раздел 9 ТЗ).
//! `cargo run --no-default-features --bin mesh-boot`
//! Вывод: TEMPLE_* / CONTEXT_* / MEMORY_WEAVER / MESH_BOOT temple=OK assistants=N

fn main() {
    let env = kvp_assistant_mesh::MeshEnv::from_manifest();
    match kvp_assistant_mesh::run_boot(&env) {
        Ok(report) => {
            kvp_assistant_mesh::print_report(&report);
        }
        Err(e) => {
            eprintln!("MESH_BOOT temple=FAIL error={e}");
            std::process::exit(1);
        }
    }
}

// File: file-pro/src-tauri/src/lib.rs
//
// Main Tauri application entry point with voice service integration.
//
// Known issue: On macOS, a crash in Tao's app delegate (did_finish_launching) can
// cause SIGABRT with "panic in a function that cannot unwind" (see tauri-apps/tauri#12886).
// If the app crashes immediately on launch, try: (1) run from terminal with
// RUST_BACKTRACE=1 for a backtrace, (2) ensure Tauri/tao/wry are up to date.

mod voice_service;
mod sql_service;
mod search_service;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let run_result = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            // app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            voice_service::transcribe_audio,
            voice_service::synthesize_speech,
            voice_service::check_voice_service_health,
            voice_service::start_voice_service,
            voice_service::check_voice_service_dependencies,
            sql_service::test_mssql_connection,
            sql_service::get_mssql_schema,
            sql_service::get_database_schema,
            sql_service::nl_to_sql,
            search_service::search_filesystem,
            search_service::replace_in_files,
        ])
        .run(tauri::generate_context!());

    if let Err(ref error) = run_result {
        eprintln!("ProjectFile Pro failed to run: {}", error);
        std::process::exit(1);
    }
}

// File: src-tauri/src/lib.rs
//
// Main Tauri application entry point with voice service integration.

mod voice_service;
mod sql_service;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            voice_service::transcribe_audio,
            voice_service::synthesize_speech,
            voice_service::check_voice_service_health,
            voice_service::start_voice_service,
            voice_service::check_voice_service_dependencies,
            sql_service::test_mssql_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

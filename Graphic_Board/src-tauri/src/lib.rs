// Opens a folder path in the OS file manager (Windows Explorer on Windows).
// Called from platform.js via invoke('open_in_explorer', { path }).
#[tauri::command]
fn open_in_explorer(path: String) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer.exe").arg(&path).spawn();

    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&path).spawn();

    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(&path).spawn();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![open_in_explorer])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

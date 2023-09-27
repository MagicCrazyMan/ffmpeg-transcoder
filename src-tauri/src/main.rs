// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

use app::{
    config::Config,
    result::{AppResult, IntoAppResult},
};
use handlers::store::TaskStore;
use log::error;
use tauri_plugin_log::LogTarget;

use crate::handlers::commands::{
    fs::files_from_directory,
    particulars::system_particulars,
    transcode::{pause_transcode, resume_transcode, start_transcode, stop_transcode},
};

pub mod app;
pub mod handlers;

/// Starts application.
fn start_app() -> AppResult<()> {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    LogTarget::Folder(PathBuf::from("logs")),
                    LogTarget::Stdout,
                    LogTarget::Webview,
                ])
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .manage(Config::from_file_or_default()?)
        .manage(TaskStore::new())
        .invoke_handler(tauri::generate_handler![
            system_particulars,
            files_from_directory,
            start_transcode,
            stop_transcode,
            pause_transcode,
            resume_transcode,
        ])
        .run(tauri::generate_context!())
        .into_app_result()?;

    Ok(())
}

fn main() {
    if let Err(e) = start_app() {
        error!("error occurred while starting up app: {e}");
    }
}

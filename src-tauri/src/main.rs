// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::PathBuf, sync::Arc};

use handlers::{config::Config, tasks::store::TaskStore};
use log::{error, LevelFilter};
use safe_exit::prevent_main_window_close;
use system_tray::{system_tray, system_tray_event};
use tauri::Manager;
use tauri_plugin_log::{LogTarget, RotationStrategy};
use tokio::sync::Mutex;

use crate::handlers::commands::{
    fs::{search_directory, write_text_file},
    system::{load_configuration, verify_directory, verify_ffmpeg, verify_ffprobe},
    task::{media_metadata, pause_task, resume_task, start_task, stop_task},
};

pub mod handlers;
pub mod safe_exit;
pub mod system_tray;

#[derive(Clone, serde::Serialize)]
struct Payload {
    args: Vec<String>,
    cwd: String,
}

/// Starts application.
fn start_app() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            app.emit_all("single-instance", Payload { args: argv, cwd })
                .unwrap();
        }))
        .plugin(
            tauri_plugin_log::Builder::default()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseUtc)
                .targets([
                    LogTarget::Folder(PathBuf::from("logs")),
                    LogTarget::Stdout,
                    LogTarget::Stderr,
                    LogTarget::Webview,
                ])
                .level(LevelFilter::Debug)
                .max_file_size(500)
                .rotation_strategy(RotationStrategy::KeepOne)
                .build(),
        )
        .manage(Arc::new(Mutex::new(None as Option<Config>)))
        .manage(TaskStore::new())
        .system_tray(system_tray())
        .on_system_tray_event(system_tray_event)
        .on_window_event(prevent_main_window_close)
        .invoke_handler(tauri::generate_handler![
            verify_ffmpeg,
            verify_ffprobe,
            verify_directory,
            load_configuration,
            search_directory,
            write_text_file,
            media_metadata,
            start_task,
            stop_task,
            pause_task,
            resume_task,
        ])
        .run(tauri::generate_context!())
}

#[derive(serde::Serialize)]
struct A {
    b: LevelFilter,
}

fn main() {
    if let Err(e) = start_app() {
        error!("error occurred while starting up app: {e}");
    }
}

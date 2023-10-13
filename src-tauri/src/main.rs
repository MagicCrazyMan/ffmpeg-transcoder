// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::PathBuf, sync::Arc};

use handlers::{config::Config, task::store::TaskStore};
use log::{error, LevelFilter};
use tauri::Manager;
use tauri_plugin_log::{LogTarget, RotationStrategy};
use tokio::sync::Mutex;

use crate::handlers::commands::{
    fs::files_from_directory,
    system::{load_configuration, verify_ffmpeg, verify_ffprobe},
    task::{media_metadata, pause_task, resume_task, start_task, stop_task},
};

pub mod handlers;

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
            println!("{}, {argv:?}, {cwd}", app.package_info().name);

            app.emit_all("single-instance", Payload { args: argv, cwd })
                .unwrap();
        }))
        .plugin(
            tauri_plugin_log::Builder::default()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseUtc)
                .targets([
                    LogTarget::Folder(PathBuf::from("logs")),
                    LogTarget::Stdout,
                    LogTarget::Webview,
                ])
                .level(LevelFilter::Debug)
                .max_file_size(500)
                .rotation_strategy(RotationStrategy::KeepOne)
                .build(),
        )
        .manage(Arc::new(Mutex::new(None as Option<Config>)))
        .manage(TaskStore::new())
        .invoke_handler(tauri::generate_handler![
            verify_ffmpeg,
            verify_ffprobe,
            load_configuration,
            files_from_directory,
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

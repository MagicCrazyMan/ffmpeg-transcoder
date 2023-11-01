// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::PathBuf, sync::Arc};

use handlers::{config::Config, tasks::store::TaskStore};
use log::{error, LevelFilter};
use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tokio::sync::Mutex;

use crate::handlers::commands::{
    fs::search_directory,
    system::{load_configuration, verify_directory, verify_ffmpeg, verify_ffprobe},
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
            app.emit("single-instance", Payload { args: argv, cwd })
                .unwrap();
        }))
        .plugin(
            tauri_plugin_log::Builder::default()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseUtc)
                .targets([
                    Target::new(TargetKind::Folder {
                        path: PathBuf::from("logs"),
                        file_name: None,
                    }),
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Stderr),
                    Target::new(TargetKind::Webview),
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
            verify_directory,
            load_configuration,
            search_directory,
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

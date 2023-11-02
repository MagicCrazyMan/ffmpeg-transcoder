use log::{error, warn};
use tauri::{
    AppHandle, CustomMenuItem, Manager, Runtime, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};

use crate::safe_exit::EXIT_REQUEST_EVENT;

fn menu() -> SystemTrayMenu {
    let exit = CustomMenuItem::new("exit", "Exit");
    let show = CustomMenuItem::new("show", "Show");
    let start = CustomMenuItem::new("start_all", "Start All Tasks");
    let pause = CustomMenuItem::new("pause_all", "Pause All Tasks");
    let stop = CustomMenuItem::new("stop_all", "Stop All Tasks");
    SystemTrayMenu::new()
        .add_item(start)
        .add_item(pause)
        .add_item(stop)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(show)
        .add_item(exit)
}

pub static START_ALL_TASKS_EVENT: &'static str = "start_all_tasks";
pub static PAUSE_ALL_TASKS_EVENT: &'static str = "pause_all_tasks";
pub static STOP_ALL_TASKS_EVENT: &'static str = "stop_all_tasks";

fn display<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_window("main") else {
        panic!("main window unexpected destroyed");
    };
    if let Err(err) = window.show() {
        panic!("failed to show main window: {err}");
    }
    if let Err(err) = window.unminimize() {
        warn!(target: "system_tray", "failed to unminimize main window: {err}")
    }
    if let Err(err) = window.set_focus() {
        warn!(target: "system_tray", "failed to focus main window: {err}")
    }
}

fn emit<R: Runtime>(app: &AppHandle<R>, event: &str) {
    if let Err(err) = app.emit_to("main", event, ()) {
        error!(target: "system_tray", "failed to emit event \"{event}\" to main window: {err}");
    }
}

pub fn system_tray_event<R: Runtime>(app: &AppHandle<R>, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "show" => display(app),
            "exit" => emit(app, EXIT_REQUEST_EVENT),
            "start_all" => emit(app, START_ALL_TASKS_EVENT),
            "pause_all" => emit(app, PAUSE_ALL_TASKS_EVENT),
            "stop_all" => emit(app, STOP_ALL_TASKS_EVENT),
            _ => {}
        },
        SystemTrayEvent::LeftClick { .. } => display(app),
        _ => {}
    }
}

pub fn system_tray() -> SystemTray {
    SystemTray::new()
        .with_tooltip("FFmpeg Transcoder")
        .with_menu(menu())
}

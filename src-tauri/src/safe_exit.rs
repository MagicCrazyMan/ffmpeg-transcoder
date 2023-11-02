use log::warn;
use tauri::{GlobalWindowEvent, WindowEvent};

pub static EXIT_REQUEST_EVENT: &'static str = "exit_request";

pub fn prevent_main_window_close(event: GlobalWindowEvent) {
    match event.event() {
        WindowEvent::CloseRequested { api, .. } => {
            if event.window().label() == "main" {
                if let Err(err) = event.window().emit(EXIT_REQUEST_EVENT, ()) {
                    warn!("failed to emit \"{EXIT_REQUEST_EVENT}\" to main window: {err}");
                }
                api.prevent_close();
            }
        }
        _ => {}
    }
}

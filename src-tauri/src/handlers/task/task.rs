use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};

use log::{info, warn};
use tauri::Manager;
use tokio::sync::Mutex;

use crate::handlers::commands::task::TaskParams;

use super::{
    message::{TaskMessage, TASK_MESSAGE_EVENT},
    state_machine::{Idle, TaskStateCode, TaskState},
};

/// Task data.
pub(super) struct TaskData {
    pub(super) id: String,
    pub(super) ffmpeg_program: String,
    pub(super) ffprobe_program: String,
    pub(super) params: TaskParams,
    pub(super) app_handle: tauri::AppHandle,
}

/// Task Item.
#[derive(Clone)]
pub struct Task {
    pub(super) data: Arc<TaskData>,
    pub(super) state: Arc<Mutex<Option<Box<dyn TaskState>>>>,
    pub(super) store: Weak<Mutex<HashMap<String, Task>>>,
}

impl Task {
    /// Creates a new task item.
    pub(super) fn new(
        id: String,
        app_handle: tauri::AppHandle,
        ffmpeg_program: String,
        ffprobe_program: String,
        params: TaskParams,
        store: Weak<Mutex<HashMap<String, Task>>>,
    ) -> Self {
        Self {
            data: Arc::new(TaskData {
                id,
                ffmpeg_program,
                ffprobe_program,
                params,
                app_handle,
            }),
            state: Arc::new(Mutex::new(Some(Box::new(Idle)))),
            store,
        }
    }
}

macro_rules! controls {
    ($($name:ident),+) => {
        $(
            pub(super) async fn $name(&self) {
                let mut state = self.state.lock().await;

                // change state
                let current_state = state.take().unwrap(); // safely unwrap
                let next_state = current_state.$name(self.clone()).await;

                let next_state_code = next_state.code();
                let next_state_message = next_state.message().map(|msg| msg.to_string());
                Self::update_state(self.clone(), next_state_code, next_state_message).await;

                state.replace(next_state);
            }
        )+
    };
}

impl Task {
    controls!(start, pause, resume, stop, finish);

    pub(super) async fn error<S>(&self, reason: S)
    where
        S: Into<String> + Send + 'static,
    {
        let mut state = self.state.lock().await;

        let current_state = state.take().unwrap(); // safely unwrap
        let next_state = current_state.error(self.clone(), reason.into()).await;

        let next_state_code = next_state.code();
        let next_state_message = next_state.message().map(|msg| msg.to_string());
        Self::update_state(self.clone(), next_state_code, next_state_message).await;

        state.replace(next_state);
    }

    async fn update_state(item: Task, next_state_code: TaskStateCode, message: Option<String>) {
        // removes from store
        match next_state_code {
            TaskStateCode::Stopped | TaskStateCode::Finished | TaskStateCode::Errored => {
                let Some(store) = item.store.upgrade() else {
                    return;
                };

                let mut store = store.lock().await;
                store.remove(&item.data.id);
            }
            TaskStateCode::Idle | TaskStateCode::Running => return,
            _ => {}
        }

        // sends message and logs
        let id = item.data.id.to_string();
        let msg = match next_state_code {
            TaskStateCode::Idle | TaskStateCode::Running => unreachable!(),
            // reserve, reset is possible in the future
            TaskStateCode::Pausing => {
                info!("[{}] job paused", id);
                TaskMessage::pausing(id)
            }
            TaskStateCode::Stopped => {
                info!("[{}] job stopped", id);
                TaskMessage::stopped(id)
            }
            TaskStateCode::Finished => {
                info!("[{}] job finished", id);
                TaskMessage::finished(id)
            }
            TaskStateCode::Errored => {
                let message = message.unwrap_or("unknown error".to_string());
                info!("[{}] job errored: {}", id, message);
                TaskMessage::errored(id, message)
            }
        };

        if let Err(err) = item.data.app_handle.emit_all(TASK_MESSAGE_EVENT, msg) {
            warn!(
                "[{}] error occurred while sending data to frontend: {}",
                item.data.id, err
            );
        };
    }
}

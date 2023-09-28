use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};

use log::{warn, info};
use tauri::Manager;
use tokio::sync::Mutex;

use super::{
    message::{TaskMessage, TASK_MESSAGE_EVENT},
    state_machine::{Idle, TaskStateCode, TaskStateMachineNode},
};

/// A transcode data.
pub(super) struct TaskData {
    pub(super) id: uuid::Uuid,
    pub(super) program: String,
    pub(super) args: Vec<String>,
    pub(super) app_handle: tauri::AppHandle,
}

impl TaskData {
    pub(super) fn new(
        id: uuid::Uuid,
        program: String,
        args: Vec<String>,
        app_handle: tauri::AppHandle,
    ) -> Self {
        Self {
            id,
            program,
            args,
            app_handle,
        }
    }
}

/// A transcode data.
#[derive(Clone)]
pub struct TaskItem {
    pub(super) data: Arc<TaskData>,
    pub(super) state: Arc<Mutex<Option<Box<dyn TaskStateMachineNode>>>>,
    pub(super) store: Weak<Mutex<HashMap<uuid::Uuid, TaskItem>>>,
}

impl TaskItem {
    /// Creates a new transcode data.
    pub(super) fn new(
        id: uuid::Uuid,
        app_handle: tauri::AppHandle,
        program: String,
        args: Vec<String>,
        store: Weak<Mutex<HashMap<uuid::Uuid, TaskItem>>>,
    ) -> Self {
        Self {
            data: Arc::new(TaskData::new(id, program, args, app_handle)),
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

                let next_state_code = next_state.state_code();
                let next_state_message = next_state.message().map(|msg| msg.to_string());
                Self::update_state(self.clone(), next_state_code, next_state_message).await;

                state.replace(next_state);
            }
        )+
    };
}

impl TaskItem {
    controls!(start, pause, resume, stop, finish);

    pub(super) async fn error<S>(&self, reason: S)
    where
        S: Into<String> + Send + 'static,
    {
        let mut state = self.state.lock().await;

        let current_state = state.take().unwrap(); // safely unwrap
        let next_state = current_state.error(self.clone(), reason.into()).await;

        let next_state_code = next_state.state_code();
        let next_state_message = next_state.message().map(|msg| msg.to_string());
        Self::update_state(self.clone(), next_state_code, next_state_message).await;

        state.replace(next_state);
    }

    async fn update_state(item: TaskItem, next_state_code: TaskStateCode, message: Option<String>) {
        // removes from store
        match next_state_code {
            TaskStateCode::Stopped | TaskStateCode::Finished | TaskStateCode::Errored => {
                let Some(store) = item.store.upgrade() else {
                    return;
                };

                let mut store = store.lock().await;
                store.remove(&item.data.id);
            }
            TaskStateCode::Running => return,
            _ => {}
        }

        // sends message and logs
        let id = item.data.id.to_string();
        let app_handle = &item.data.app_handle;
        let msg = match next_state_code {
            // reserve, reset is possible in the future
            TaskStateCode::Idle => {
                info!("[{}] job reset", id);
                TaskMessage::idle(id)
            },
            TaskStateCode::Running => unreachable!(),
            TaskStateCode::Pausing => {
                info!("[{}] job paused", id);
                TaskMessage::pausing(id)
            },
            TaskStateCode::Stopped => {
                info!("[{}] job stopped", id);
                TaskMessage::stopped(id)
            },
            TaskStateCode::Finished => {
                info!("[{}] job finished", id);
                TaskMessage::finished(id)
            },
            TaskStateCode::Errored => {
                let message = message.unwrap_or("unknown error".to_string());
                info!("[{}] job errored: {}", id, message);
                TaskMessage::errored(id, message)
            }
        };

        if let Err(err) = app_handle.emit_all(TASK_MESSAGE_EVENT, msg) {
            warn!(
                "[{}] error occurred while sending data to frontend: {}",
                item.data.id, err
            );
        };
    }
}

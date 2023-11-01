use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};

use log::{error, info};
use tauri::Manager;
use tokio::sync::Mutex;

use crate::handlers::{
    commands::task::TaskArgs,
    tasks::message::{TaskMessage, TASK_MESSAGE_EVENT},
};

use super::state_machine::{Idle, TaskState};

/// Task data.
pub struct TaskData {
    pub id: String,
    pub ffmpeg_program: String,
    pub ffprobe_program: String,
    pub args: TaskArgs,
    pub app_handle: tauri::AppHandle,
}

/// Task Item.
#[derive(Clone)]
pub struct Task {
    pub data: Arc<TaskData>,
    pub state: Arc<Mutex<Option<Box<dyn TaskState>>>>,
    pub store: Weak<Mutex<HashMap<String, Task>>>,
}

impl Task {
    /// Creates a new task item.
    pub fn new(
        id: String,
        app_handle: tauri::AppHandle,
        ffmpeg_program: String,
        ffprobe_program: String,
        args: TaskArgs,
        store: Weak<Mutex<HashMap<String, Task>>>,
    ) -> Self {
        Self {
            data: Arc::new(TaskData {
                id,
                ffmpeg_program,
                ffprobe_program,
                args,
                app_handle,
            }),
            state: Arc::new(Mutex::new(Some(Box::new(Idle)))),
            store,
        }
    }
}

macro_rules! to_next_state {
    ($(($name:ident, $func:ident)),+) => {
        $(
            async fn $name(&self) {
                let mut state = self.state.lock().await;
                *state = Some(state.take().unwrap().$func(self.clone()).await);
            }
        )+
    };
}

impl Task {
    to_next_state! {
        (to_start, start),
        (to_pause, pause),
        (to_resume, resume),
        (to_stop, stop),
        (to_finish, finish)
    }

    async fn remove(&self) {
        // removes task from store
        let Some(store) = self.store.upgrade() else {
            return;
        };
        store.lock().await.remove(&self.data.id);
    }

    fn send_message(&self, payload: TaskMessage<'_>) {
        // send message to frontend
        if let Err(err) = self.data.app_handle.emit(TASK_MESSAGE_EVENT, payload) {
            error!(
                "[{}] failed to send message to frontend: {}",
                self.data.id, err
            );
        }
    }

    pub async fn start(&self) {
        self.to_start().await;
        info!("[{}] task started", self.data.id);
    }

    pub async fn pause(&self) {
        self.to_pause().await;
        info!("[{}] task started", self.data.id);
    }

    pub async fn resume(&self) {
        self.to_resume().await;
        info!("[{}] task started", self.data.id);
    }

    pub async fn stop(&self) {
        self.to_stop().await;
        self.remove().await;
        info!("[{}] task stopped", self.data.id);
    }

    pub async fn finish(&self) {
        self.to_finish().await;
        self.remove().await;
        self.send_message(TaskMessage::finished(self.data.id.clone()));
        info!("[{}] task finished", self.data.id);
    }

    pub async fn error(&self, reason: String) {
        let mut state = self.state.lock().await;
        *state = Some(
            state
                .take()
                .unwrap()
                .error(self.clone(), reason.clone())
                .await,
        );

        self.remove().await;
        self.send_message(TaskMessage::errored(self.data.id.clone(), reason));

        info!("[{}] task errored", self.data.id);
    }
}

use std::{collections::HashMap, sync::Arc};

use tokio::sync::Mutex;

use crate::handlers::{commands::task::TaskArgs, error::Error};

use super::task::Task;

/// Task managing store center.
pub struct TaskStore {
    store: Arc<Mutex<HashMap<String, Task>>>,
}

macro_rules! operations {
    ($((
        $(#[$meta:meta])*
        $name:ident
    )),+) => {
        $(
            $(#[$meta])*
            pub async fn $name(&self, id: &str) -> Result<(), Error> {
                let store = self.store.lock().await;
                let Some(task) = store.get(id) else {
                    return Err(Error::task_not_found(id));
                };

                let task = task.clone();
                drop(store);

                task.$name().await;
                Ok(())
            }
        )+
    };
}

impl TaskStore {
    /// Creates a new transcode store.
    pub fn new() -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Adds and starts a new task.
    /// Returns an identifier which points to the task.
    pub async fn start(
        &self,
        id: String,
        args: TaskArgs,
        app_handle: tauri::AppHandle,
        ffmpeg_program: String,
        ffprobe_program: String,
    ) -> Result<(), Error> {
        let mut store = self.store.lock().await;
        if store.contains_key(&id) {
            return Err(Error::task_existing(id));
        }

        let task = Task::new(
            id.clone(),
            app_handle,
            ffmpeg_program,
            ffprobe_program,
            args,
            Arc::downgrade(&self.store),
        );
        store.insert(id, task.clone());

        // drops store immediately
        drop(store);

        task.start().await;
        Ok(())
    }

    operations! {
        (
            /// Stops a task by id.
            stop
        ),
        (
            /// Pauses a task by id.
            pause
        ),
        (
            /// Resumes a task by id.
            resume
        )
    }
}

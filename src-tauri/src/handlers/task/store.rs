use std::{collections::HashMap, sync::Arc};

use log::warn;
use tokio::sync::Mutex;

use crate::handlers::error::Error;

use super::item::TaskItem;

pub struct TaskStore {
    store: Arc<Mutex<HashMap<uuid::Uuid, TaskItem>>>,
}

macro_rules! controls {
    (
        $(#[$meta:meta])*
        $name:ident
    ) => {
        $(#[$meta])*
        pub async fn $name(&self, id: &uuid::Uuid) {
            let mut store = self.store.lock().await;
            let Some(task) = store.get_mut(id) else {
                warn!("jon id {} not found", id);
                return;
            };

            let task = task.clone();
            tokio::spawn(async move { task.$name().await });
        }
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
        app_handle: tauri::AppHandle,
        program: String,
        args: Vec<String>,
    ) -> Result<uuid::Uuid, Error> {
        let id = uuid::Uuid::new_v4();
        let task = TaskItem::new(
            id.clone(),
            app_handle,
            program,
            args,
            Arc::downgrade(&self.store),
        );

        self.store.lock().await.insert(id.clone(), task.clone());

        tokio::spawn(async move { task.start().await });

        Ok(id)
    }

    controls!(
        /// Stops a task by id.
        stop
    );

    controls!(
        /// Pauses a task by id.
        pause
    );

    controls!(
        /// Resumes a task by id.
        resume
    );
}

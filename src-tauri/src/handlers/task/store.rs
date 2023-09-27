use std::{collections::HashMap, sync::Arc};

use log::warn;
use tokio::sync::Mutex;

use crate::handlers::error::Error;

use super::item::TaskItem;

pub struct TaskStore {
    store: Arc<Mutex<HashMap<uuid::Uuid, TaskItem>>>,
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

        task.start();

        self.store.lock().await.insert(id.clone(), task);

        Ok(id)
    }

    /// Stops a transcode data.
    pub async fn stop(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.stop();
    }

    /// Pauses a transcode data.
    pub async fn pause(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.pause();
    }

    /// Resumes a transcode data.
    pub async fn resume(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.resume();
    }
}

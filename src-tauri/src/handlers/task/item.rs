use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};

use log::warn;
use tokio::{sync::Mutex, task::JoinHandle};
use tokio_util::sync::CancellationToken;

use super::state_machine::{Idle, TaskStateCode, TaskStateMachineNode};

/// A transcode data.
pub(crate) struct TaskData {
    id: uuid::Uuid,
    program: String,
    args: Vec<String>,
    app_handle: tauri::AppHandle,
}

impl TaskData {
    pub(crate) fn new(
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

    pub(crate) fn id(&self) -> &uuid::Uuid {
        &self.id
    }

    pub(crate) fn program(&self) -> &str {
        &self.program
    }

    pub(crate) fn args(&self) -> &Vec<String> {
        &self.args
    }
}

impl TaskData {
    async fn start_capture(&mut self) {
        // let mut process = process.lock().await;
        // let mut capture_cancellations = capture_cancellations.lock().await;

        // let process = process.as_mut().unwrap(); // safely unwrap
        // let stdout = process.stdout.take().unwrap(); // safely unwrap
        // let stderr = process.stderr.take().unwrap(); // safely unwrap

        // // spawn a thread to capture stdout
        // let state_cloned = Arc::clone(&state);
        // let stdout_cancellation = CancellationToken::new();
        // let stdout_cancellation_cloned = stdout_cancellation.clone();
        // let stdout_handle = tokio::spawn(async move {
        //     let mut line = String::new();
        //     let mut reader = BufReader::new(stdout);
        //     let mut message = TaskRunningMessage::new(id.to_string());
        //     loop {
        //         // check state
        //         if *state_cloned.lock().await != TaskState::Running {
        //             break;
        //         }

        //         // read from stdout
        //         let (should_stop, len) = tokio::select! {
        //             _ = stdout_cancellation_cloned.cancelled() => {
        //                 (true, 0)
        //             }
        //             len = reader.read_line(&mut line) => {
        //                 match len {
        //                     Ok(len) =>  (false, len),
        //                     Err(err) => {
        //                         *state_cloned.lock().await = TaskState::Errored(err.to_string());
        //                         (true, 0)
        //                     }
        //                 }
        //             }
        //         };

        //         // should stop or reach eof
        //         if should_stop || len == 0 {
        //             break;
        //         }

        //         let trimmed_line = line.trim();
        //         trace!("[{}] capture stdout output: {}", id, trimmed_line);

        //         // store raw message
        //         message.raw.push(trimmed_line.to_string());

        //         // extract key value
        //         let mut splitted = trimmed_line.split("=");
        //         if let (Some(key), Some(value)) = (splitted.next(), splitted.next()) {
        //             let key = key.trim();
        //             let value = value.trim();
        //             match key {
        //                 "frame" => {
        //                     message.frame = value.parse::<usize>().ok();
        //                 }
        //                 "fps" => {
        //                     message.fps = value.parse::<f64>().ok();
        //                 }
        //                 "bitrate" => {
        //                     if value == "N/A" {
        //                         message.bitrate = None;
        //                     } else {
        //                         message.bitrate = value[..value.len() - 7].parse::<f64>().ok();
        //                     }
        //                 }
        //                 "total_size" => {
        //                     message.total_size = value.parse::<usize>().ok();
        //                 }
        //                 "out_time_ms" => {
        //                     message.output_time_ms = value.parse::<usize>().ok();
        //                 }
        //                 "dup_frames" => {
        //                     message.dup_frames = value.parse::<usize>().ok();
        //                 }
        //                 "drop_frames" => {
        //                     message.drop_frames = value.parse::<usize>().ok();
        //                 }
        //                 "speed" => {
        //                     if value == "N/A" {
        //                         message.speed = None;
        //                     } else {
        //                         message.speed = value[..value.len() - 1].parse::<f64>().ok();
        //                     }
        //                 }
        //                 "progress" => {
        //                     let msg = match value {
        //                         "continue" => Some(TaskMessage::running(&message)),
        //                         "end" => Some(TaskMessage::finished(id.to_string())),
        //                         _ => None,
        //                     };

        //                     // send message if a single frame collected
        //                     if let Some(msg) = msg {
        //                         match app_handle.emit_all(TASK_MESSAGE_EVENT, &msg) {
        //                             Ok(_) => debug!("[{}] send message to frontend", id),
        //                             Err(err) => {
        //                                 *state_cloned.lock().await =
        //                                     TaskState::Errored(err.to_string());
        //                                 break;
        //                             }
        //                         }

        //                         message.clear();
        //                     }
        //                 }
        //                 _ => {}
        //             }

        //             line.clear();
        //         };
        //     }

        //     reader.into_inner()
        // });
        // // spawn a thread to capture stderr
        // let state_cloned = Arc::clone(&state);
        // let stderr_cancellation = CancellationToken::new();
        // let stderr_cancellation_cloned = stderr_cancellation.clone();
        // let stderr_handle = tokio::spawn(async move {
        //     let mut line = String::new();
        //     let mut reader = BufReader::new(stderr);

        //     // read from stdout
        //     let (should_stop, len) = tokio::select! {
        //         _ = stderr_cancellation_cloned.cancelled() => {
        //             (true, 0)
        //         }
        //         len = reader.read_line(&mut line) => {
        //             match len {
        //                 Ok(len) =>  (false, len),
        //                 Err(err) => {
        //                     *state_cloned.lock().await = TaskState::Errored(err.to_string());;
        //                     (true, 0)
        //                 }
        //             }
        //         }
        //     };

        //     // should stop or reach eof
        //     if should_stop || len == 0 {
        //         reader.into_inner()
        //     } else {
        //         let line = line.trim().to_string();
        //         error!("[{}] capture stderr output: {}", id, line);
        //         *state_cloned.lock().await = TaskState::Errored(line);

        //         reader.into_inner()
        //     }
        // });

        // *capture_cancellations = Some((stdout_cancellation, stderr_cancellation));

        // (stdout_handle, stderr_handle)

        todo!()
    }

    async fn capturing(&mut self) {}

    /// Starts watchdog watching around the subprocess.
    ///
    /// stdout and stderr of subprocess are taken out and send to capturing threads,
    /// do not try to use them when watchdog running.
    pub(crate) fn start_watchdog(
        &self,
        capture_cancellation: &CancellationToken,
    ) -> JoinHandle<()> {
        // let id = self.id.clone();
        // let app_handle = self.app_handle.clone();
        // let capture_cancellation = capture_cancellation.clone();

        // tokio::spawn(async move {
        //     info!("[{}] start subprocess output capturing", id);

        //     // spawns threads to capture log from stdout and stderr.
        //     // stdout and stdin are taken out from subprocess
        //     let (stdout_handle, stderr_handle) = Self::start_capture(
        //         id.clone(),
        //         app_handle.clone(),
        //         Arc::clone(&state),
        //         Arc::clone(&process),
        //         Arc::clone(&capture_cancellation),
        //     )
        //     .await;

        //     // waits until capturing threads exit, and do cleanup then.
        //     Self::capturing(
        //         id,
        //         store,
        //         app_handle,
        //         stdout_handle,
        //         stderr_handle,
        //         state,
        //         process,
        //         capture_cancellation,
        //     )
        //     .await;
        // });
        todo!()
    }
}

/// A transcode data.
#[derive(Clone)]
pub struct TaskItem {
    data: Arc<TaskData>,
    state: Arc<Mutex<Option<Box<dyn TaskStateMachineNode>>>>,
    store: Weak<Mutex<HashMap<uuid::Uuid, TaskItem>>>,
}

macro_rules! controls {
    ($($name:ident),+) => {
        $(
            pub(crate) fn $name(&self) {
                let data = Arc::clone(&self.data);
                let store = Weak::clone(&self.store);
                let state = Arc::clone(&self.state);

                tokio::spawn(async move {
                    let mut state = state.lock().await;

                    // change state
                    let current_state = state.take().unwrap(); // safely unwrap
                    let next_state = current_state.$name(&data).await;

                    // do some clean job
                    let next_state_code = next_state.state_code();
                    match next_state_code {
                        TaskStateCode::Stopped | TaskStateCode::Finished | TaskStateCode::Errored => {
                            let Some(store) = store.upgrade() else {
                                return;
                            };

                            let mut store = store.lock().await;
                            store.remove(&data.id);
                        }
                        _ => {}
                    }

                    state.replace(next_state);
                });
            }
        )+
    };
}

impl TaskItem {
    /// Creates a new transcode data.
    pub(crate) fn new(
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

    controls!(start, pause, resume, stop);

    // pub(crate) fn A(&self) {
    //     let data = Arc::clone(&self.data);
    //     let state = Arc::clone(&self.state);

    //     tokio::spawn(async move {
    //         let mut data = data.lock().await;
    //         let mut state = state.lock().await;

    //         // change state
    //         let current_state = state.take().unwrap(); // safely unwrap
    //         let next_state = current_state.start(&mut data).await;

    //         // do some clean job
    //         let next_state_code = next_state.state_code();
    //         match next_state_code {
    //             TaskStateCode::Stopped | TaskStateCode::Finished | TaskStateCode::Errored => {
    //                 let Some(store) = data.store.upgrade() else {
    //                     return;
    //                 };

    //                 let mut store = store.lock().await;
    //                 store.remove(data.id());
    //             }
    //             _ => {}
    //         }

    //         state.replace(next_state);
    //     });
    // }
}

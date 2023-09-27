use std::{
    collections::HashMap,
    process::{ExitStatus, Stdio},
    sync::{Arc, Weak},
};

use async_trait::async_trait;
use log::{debug, error, info, trace, warn};
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStderr, ChildStdout, Command},
    sync::{Mutex, MutexGuard},
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;

use super::error::Error;

pub struct TaskStore {
    store: Arc<Mutex<HashMap<uuid::Uuid, Task>>>,
}

impl TaskStore {
    /// Creates a new transcode store.
    pub fn new() -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Adds and starts a new transcode data.
    /// returning an identifier point to current data.
    pub async fn add_and_start(
        &self,
        app_handle: tauri::AppHandle,
        program: String,
        args: Vec<String>,
    ) -> Result<uuid::Uuid, Error> {
        let id = uuid::Uuid::new_v4();
        let mut task = Task::new(
            id.clone(),
            Arc::downgrade(&self.store),
            app_handle,
            program,
            args,
        );

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

        task.stop().await;
    }

    /// Pauses a transcode data.
    pub async fn pause(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.pause().await;
    }

    /// Resumes a transcode data.
    pub async fn resume(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.resume().await;
    }
}

/// A transcode data.
pub struct TaskData {
    id: uuid::Uuid,
    store: Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
    program: String,
    args: Vec<String>,
    app_handle: tauri::AppHandle,
    // state: Arc<Mutex<Box<dyn State>>>,
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
    fn start_watchdog(&mut self, capture_cancellation: &CancellationToken) -> JoinHandle<()> {
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

    async fn remove(&mut self) {
        match self.store.upgrade() {
            Some(store) => {
                store.lock().await.remove(&self.id);
            }
            None => {
                warn!("[{}] transcode store had been dropped", &self.id);
            }
        };
    }
}

/// A transcode data.
pub struct Task {
    data: TaskData,
    state: Arc<Mutex<Option<Box<dyn TaskStateNode>>>>,
}

impl Task {
    /// Creates a new transcode data.
    fn new(
        id: uuid::Uuid,
        store: Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
        app_handle: tauri::AppHandle,
        program: String,
        args: Vec<String>,
    ) -> Self {
        Self {
            data: TaskData {
                id,
                store,
                program,
                args,
                app_handle,
            },
            state: Arc::new(Mutex::new(Some(Box::new(Idle)))),
        }
    }
    async fn start(&mut self) {
        let mut state = self.state.lock().await;
        let current_state = state.take().unwrap(); // safely unwrap
        let next_state = current_state.start(&mut self.data).await;
        state.replace(next_state);
    }

    async fn pause(&mut self) {}

    async fn resume(&mut self) {}

    async fn stop(&mut self) {}

    async fn cleanup(&mut self, next_state: Box<dyn TaskStateNode>) {}
}

static TASK_MESSAGE_EVENT: &'static str = "transcoding";

#[derive(Debug, Clone, serde::Serialize)]
pub struct TaskRunningMessage {
    id: String,
    raw: Vec<String>,
    frame: Option<usize>,
    fps: Option<f64>,
    bitrate: Option<f64>,
    total_size: Option<usize>,
    output_time_ms: Option<usize>,
    dup_frames: Option<usize>,
    drop_frames: Option<usize>,
    speed: Option<f64>,
}

impl TaskRunningMessage {
    fn new(id: String) -> Self {
        Self {
            id: id.to_string(),
            raw: Vec::with_capacity(20),
            frame: None,
            fps: None,
            bitrate: None,
            total_size: None,
            output_time_ms: None,
            dup_frames: None,
            drop_frames: None,
            speed: None,
        }
    }

    fn clear(&mut self) {
        self.frame = None;
        self.fps = None;
        self.bitrate = None;
        self.total_size = None;
        self.output_time_ms = None;
        self.dup_frames = None;
        self.drop_frames = None;
        self.raw.clear();
    }
}

/// Task message informing task situation.
#[derive(Debug, Clone, serde::Serialize)]
pub enum TaskMessage<'a> {
    Running(&'a TaskRunningMessage),
    Paused { id: String },
    Stopped { id: String },
    Finished { id: String },
    Errored { id: String, reason: String },
}

impl<'a> TaskMessage<'a> {
    pub fn running(msg: &'a TaskRunningMessage) -> Self {
        Self::Running(msg)
    }

    pub fn paused(id: String) -> Self {
        Self::Paused { id }
    }

    pub fn stopped(id: String) -> Self {
        Self::Stopped { id }
    }

    pub fn finished(id: String) -> Self {
        Self::Finished { id }
    }

    pub fn errored(id: String, reason: String) -> Self {
        Self::Errored { id, reason }
    }
}


// #[async_trait]
// trait ChildUtils {
//     async fn kill_and_wait(&mut self) -> Result<(), std::io::Error>;
// }

// #[async_trait]
// impl ChildUtils for Child {
//     async fn kill_and_wait(&mut self) -> Result<(), std::io::Error> {
//         self.start_kill()?;
//         self.wait().await?;
//         Ok(())
//     }
// }

#[async_trait]
trait TaskStateNode: Send {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode>;

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode>;

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode>;

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode>;

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode>;
}

struct Idle;

#[async_trait]
impl TaskStateNode for Idle {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        let process = Command::new(&data.program)
            .args(&data.args)
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|err| match err.kind() {
                std::io::ErrorKind::NotFound => Error::ffmpeg_not_found(&data.program),
                _ => Error::ffmpeg_unavailable(&data.program, err),
            });
        let process = match process {
            Ok(process) => process,
            Err(err) => {
                return Box::new(Errored::from_err(err));
            }
        };

        let watchdog_cancellation = CancellationToken::new();
        let watchdog_handle = data.start_watchdog(&watchdog_cancellation);

        let next_state = Box::new(Running {
            process,
            watchdog_cancellation,
            watchdog_handle,
        });

        info!(
            "[{}] start task with command: {} {}",
            data.id,
            data.program,
            data.args
                .iter()
                .map(|arg| if arg.contains(" ") {
                    format!("\"{arg}\"")
                } else {
                    arg.to_string()
                })
                .collect::<Vec<_>>()
                .join(" ")
        );

        next_state
    }

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to pause a not start task", data.id);
        self
    }

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to resume a not start task", data.id);
        self
    }

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        Box::new(Stopped)
    }

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode> {
        todo!()
    }
}

struct Running {
    process: Child,
    watchdog_cancellation: CancellationToken,
    watchdog_handle: JoinHandle<()>,
}

#[async_trait]
impl TaskStateNode for Running {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to start a running task", data.id);
        self
    }

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        let mut process = self.process;

        #[cfg(windows)]
        {
            if let Err(err) = process.stdin.as_mut().unwrap().write_all(&[0xd]).await {
                return Box::new(Errored::from_err(err));
            }
        }

        #[cfg(not(windows))]
        {}

        self.watchdog_cancellation.cancel();

        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Pausing { process })
        }
    }

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to resume a running task", data.id);
        self
    }

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        let mut process = self.process;
        let kill = async {
            process.start_kill()?;
            process.wait().await
        };
        if let Err(err) = kill.await {
            return Box::new(Errored::from_err(err));
        };

        self.watchdog_cancellation.cancel();
        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Stopped)
        }
    }

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode> {
        todo!()
    }
}

struct Pausing {
    process: Child,
}

#[async_trait]
impl TaskStateNode for Pausing {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to start a pausing task", data.id);
        self
    }

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to pause a pausing task", data.id);
        self
    }

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        let mut process = self.process;

        #[cfg(windows)]
        {
            if let Err(err) = process.stdin.as_mut().unwrap().write_all(&[0xa]).await {
                return Box::new(Errored::from_err(err));
            }
        }

        #[cfg(not(windows))]
        {}

        let watchdog_cancellation = CancellationToken::new();
        let watchdog_handle = data.start_watchdog(&watchdog_cancellation);

        Box::new(Running {
            process,
            watchdog_cancellation,
            watchdog_handle,
        })
    }

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        let mut process = self.process;
        let kill = async {
            process.start_kill()?;
            process.wait().await
        };
        if let Err(err) = kill.await {
            return Box::new(Errored::from_err(err));
        };

        Box::new(Stopped)
    }

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode> {
        todo!()
    }
}

struct Stopped;

#[async_trait]
impl TaskStateNode for Stopped {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to start a stopped task", data.id);
        self
    }

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to pause a stopped task", data.id);
        self
    }

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to resume a stopped task", data.id);
        self
    }

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        self
    }

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode> {
        todo!()
    }
}

struct Errored {
    reason: String,
}

impl Errored {
    fn from_err<E: std::error::Error>(reason: E) -> Self {
        Self {
            reason: reason.to_string(),
        }
    }

    fn from_string<S: Into<String>>(reason: S) -> Self {
        Self {
            reason: reason.into(),
        }
    }
}

#[async_trait]
impl TaskStateNode for Errored {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to start a errored task", data.id);
        self
    }

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to pause a errored task", data.id);
        self
    }

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to resume a errored task", data.id);
        self
    }

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to stop a errored task", data.id);
        self
    }

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode> {
        todo!()
    }
}

struct Finished;

#[async_trait]
impl TaskStateNode for Finished {
    async fn start(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to start a finished task", data.id);
        self
    }

    async fn pause(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to pause a finished task", data.id);
        self
    }

    async fn resume(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to resume a finished task", data.id);
        self
    }

    async fn stop(self: Box<Self>, data: &mut TaskData) -> Box<dyn TaskStateNode> {
        warn!("[{}] attempting to stop a finished task", data.id);
        self
    }

    async fn error(
        self: Box<Self>,
        data: &mut TaskData,
        reason: String,
    ) -> Box<dyn TaskStateNode> {
        todo!()
    }
}
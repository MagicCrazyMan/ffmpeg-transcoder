use std::{
    collections::HashMap,
    process::Stdio,
    sync::{Arc, Weak},
};

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

    /// Adds and starts a new transcode task.
    /// returning an identifier point to current task.
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

        task.start().await?;
        self.store.lock().await.insert(id.clone(), task);

        Ok(id)
    }

    /// Stops a transcode task.
    pub async fn stop(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.stop().await;
    }

    /// Pauses a transcode task.
    pub async fn pause(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.pause().await;
    }

    /// Resumes a transcode task.
    pub async fn resume(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(task) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        task.resume().await;
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum TaskState {
    Idle,
    Running,
    Pausing,
    Stopped,
    Finished,
    Errored(String),
}

/// A transcode task.
#[derive(Debug)]
pub struct Task {
    id: uuid::Uuid,
    store: Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
    program: String,
    args: Vec<String>,
    app_handle: tauri::AppHandle,
    state: Arc<Mutex<TaskState>>,
    process: Arc<Mutex<Option<Child>>>,
    capture_cancellations: Arc<Mutex<Option<(CancellationToken, CancellationToken)>>>,
}

impl Task {
    /// Creates a new transcode task.
    fn new(
        id: uuid::Uuid,
        store: Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
        app_handle: tauri::AppHandle,
        program: String,
        args: Vec<String>,
    ) -> Self {
        Self {
            id,
            store,
            program: program.into(),
            args: args.into(),
            app_handle,
            state: Arc::new(Mutex::new(TaskState::Idle)),
            process: Arc::new(Mutex::new(None)),
            capture_cancellations: Arc::new(Mutex::new(None)),
        }
    }

    /// Starts the task.
    async fn start(&mut self) -> Result<(), Error> {
        let mut process = self.process.lock().await;
        let mut state = self.state.lock().await;
        if *state != TaskState::Idle {
            debug!("[{}] attempting to start a started task", self.id);
            return Ok(());
        }

        let child = match Command::new(&self.program)
            .args(&self.args)
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(err) => {
                return match err.kind() {
                    std::io::ErrorKind::NotFound => Err(Error::ffmpeg_not_found(&self.program)),
                    _ => Err(Error::ffmpeg_unavailable(&self.program, err)),
                }
            }
        };

        *process = Some(child);
        *state = TaskState::Running;
        drop(state);
        drop(process);

        self.start_watchdog();

        info!(
            "[{}] start task with command: {} {}",
            self.id,
            self.program,
            self.args
                .iter()
                .map(|arg| if arg.contains(" ") {
                    format!("\"{arg}\"")
                } else {
                    arg.to_string()
                })
                .collect::<Vec<_>>()
                .join(" ")
        );

        Ok(())
    }

    /// Pauses the task.
    async fn pause(&self) {
        let capture_cancellations = self.capture_cancellations.lock().await;
        let mut state = self.state.lock().await;
        if *state != TaskState::Running {
            warn!("[{}] attempting to pause a not running task", self.id);
            return;
        }

        *state = TaskState::Pausing;
        let capture_cancellations = capture_cancellations.as_ref().unwrap(); // safely unwrap
        capture_cancellations.0.cancel();
        capture_cancellations.1.cancel();
    }

    /// Resumes the task.
    async fn resume(&mut self) {
        let mut process = self.process.lock().await;
        let mut state = self.state.lock().await;
        if *state != TaskState::Pausing {
            warn!("[{}] attempting to resume a not pausing task", self.id);
            return;
        }

        // write a '\n'(Line Feed, `0xa` in ASCII table) character
        // to ffmpeg subprocess via stdin to resume.
        #[cfg(windows)]
        {
            if let Err(err) = process
                .as_mut()
                .unwrap() // safely unwrap
                .stdin
                .as_mut()
                .unwrap() // safely unwrap
                .write_all(&[0xa])
                .await
            {
                error!(
                    "[{}] error occurred while writing to stdin: {}, interrupt task",
                    self.id, err
                );
                self.stop().await;
                return;
            };
        }

        *state = TaskState::Running;
        drop(state);
        drop(process);

        self.start_watchdog();

        info!("[{}] resume task", self.id);
    }

    /// Stops the task.
    async fn stop(&self) {
        let process = self.process.lock().await;
        let capture_cancellations = self.capture_cancellations.lock().await;
        let mut state = self.state.lock().await;

        match *state {
            TaskState::Idle => {
                *state = TaskState::Stopped;
                Self::clean(process, capture_cancellations, &self.id, &self.store).await;
            }
            TaskState::Running => {
                *state = TaskState::Stopped;
                let capture_cancellations = capture_cancellations.as_ref().unwrap(); // safely unwrap
                capture_cancellations.0.cancel();
                capture_cancellations.1.cancel();
            }
            TaskState::Pausing => {
                Self::kill_and_clean(process, capture_cancellations, &self.id, &self.store).await;
                info!("[{}] task killed and stopped", self.id);

                *state = TaskState::Stopped;
            }
            _ => {
                debug!(
                    "[{}] attempting to kill a stopped or finished task",
                    self.id
                );
            }
        };
    }

    async fn kill_and_clean(
        mut process: MutexGuard<'_, Option<Child>>,
        capture_cancellations: MutexGuard<'_, Option<(CancellationToken, CancellationToken)>>,
        id: &uuid::Uuid,
        store: &Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
    ) {
        if let Some(process) = process.as_mut() {
            Self::kill(process, id).await;
        }
        Self::clean(process, capture_cancellations, id, store).await;
    }

    async fn kill(process: &mut Child, id: &uuid::Uuid) {
        if let Err(err) = process.start_kill() {
            error!("[{}] error occurred while killing subprocess {}", id, err);
            return;
        };

        match process.wait().await {
            Ok(status) => {
                if status.success() {
                    info!("[{}] subprocess successfully exit", id);
                } else {
                    match status.code() {
                        Some(code) => {
                            warn!("[{}] subprocess exit with status code {}", id, code)
                        }
                        None => warn!("[{}] subprocess exit with no status code", id),
                    }
                }
            }
            Err(err) => {
                error!("[{}] error occurred while killing subprocess {}", id, err);
                return;
            }
        };
    }

    async fn clean(
        mut process: MutexGuard<'_, Option<Child>>,
        mut capture_cancellations: MutexGuard<'_, Option<(CancellationToken, CancellationToken)>>,
        id: &uuid::Uuid,
        store: &Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
    ) {
        *process = None;
        *capture_cancellations = None;

        match store.upgrade() {
            Some(store) => {
                store.lock().await.remove(&id);
            }
            None => {
                warn!("[{}] transcode store had been dropped", id);
            }
        };
    }

    async fn start_capture(
        id: uuid::Uuid,
        app_handle: tauri::AppHandle,
        state: Arc<Mutex<TaskState>>,
        process: Arc<Mutex<Option<Child>>>,
        capture_cancellations: Arc<Mutex<Option<(CancellationToken, CancellationToken)>>>,
    ) -> (JoinHandle<ChildStdout>, JoinHandle<ChildStderr>) {
        let mut process = process.lock().await;
        let mut capture_cancellations = capture_cancellations.lock().await;

        let process = process.as_mut().unwrap(); // safely unwrap
        let stdout = process.stdout.take().unwrap(); // safely unwrap
        let stderr = process.stderr.take().unwrap(); // safely unwrap

        // spawn a thread to capture stdout
        let state_cloned = Arc::clone(&state);
        let stdout_cancellation = CancellationToken::new();
        let stdout_cancellation_cloned = stdout_cancellation.clone();
        let stdout_handle = tokio::spawn(async move {
            let mut line = String::new();
            let mut reader = BufReader::new(stdout);
            let mut message = TaskRunningMessage::new(id.to_string());
            loop {
                // check state
                if *state_cloned.lock().await != TaskState::Running {
                    break;
                }

                // read from stdout
                let (should_stop, len) = tokio::select! {
                    _ = stdout_cancellation_cloned.cancelled() => {
                        (true, 0)
                    }
                    len = reader.read_line(&mut line) => {
                        match len {
                            Ok(len) =>  (false, len),
                            Err(err) => {
                                *state_cloned.lock().await = TaskState::Errored(err.to_string());
                                (true, 0)
                            }
                        }
                    }
                };

                // should stop or reach eof
                if should_stop || len == 0 {
                    break;
                }

                let trimmed_line = line.trim();
                trace!("[{}] capture stdout output: {}", id, trimmed_line);

                // store raw message
                message.raw.push(trimmed_line.to_string());

                // extract key value
                let mut splitted = trimmed_line.split("=");
                if let (Some(key), Some(value)) = (splitted.next(), splitted.next()) {
                    let key = key.trim();
                    let value = value.trim();
                    match key {
                        "frame" => {
                            message.frame = value.parse::<usize>().ok();
                        }
                        "fps" => {
                            message.fps = value.parse::<f64>().ok();
                        }
                        "bitrate" => {
                            if value == "N/A" {
                                message.bitrate = None;
                            } else {
                                message.bitrate = value[..value.len() - 7].parse::<f64>().ok();
                            }
                        }
                        "total_size" => {
                            message.total_size = value.parse::<usize>().ok();
                        }
                        "out_time_ms" => {
                            message.output_time_ms = value.parse::<usize>().ok();
                        }
                        "dup_frames" => {
                            message.dup_frames = value.parse::<usize>().ok();
                        }
                        "drop_frames" => {
                            message.drop_frames = value.parse::<usize>().ok();
                        }
                        "speed" => {
                            if value == "N/A" {
                                message.speed = None;
                            } else {
                                message.speed = value[..value.len() - 1].parse::<f64>().ok();
                            }
                        }
                        "progress" => {
                            let msg = match value {
                                "continue" => Some(TaskMessage::running(&message)),
                                "end" => Some(TaskMessage::finished(id.to_string())),
                                _ => None,
                            };

                            // send message if a single frame collected
                            if let Some(msg) = msg {
                                match app_handle.emit_all(TASK_MESSAGE_EVENT, &msg) {
                                    Ok(_) => debug!("[{}] send message to frontend", id),
                                    Err(err) => {
                                        *state_cloned.lock().await =
                                            TaskState::Errored(err.to_string());
                                        break;
                                    }
                                }

                                message.clear();
                            }
                        }
                        _ => {}
                    }

                    line.clear();
                };
            }

            reader.into_inner()
        });
        // spawn a thread to capture stderr
        let state_cloned = Arc::clone(&state);
        let stderr_cancellation = CancellationToken::new();
        let stderr_cancellation_cloned = stderr_cancellation.clone();
        let stderr_handle = tokio::spawn(async move {
            let mut line = String::new();
            let mut reader = BufReader::new(stderr);

            // read from stdout
            let (should_stop, len) = tokio::select! {
                _ = stderr_cancellation_cloned.cancelled() => {
                    (true, 0)
                }
                len = reader.read_line(&mut line) => {
                    match len {
                        Ok(len) =>  (false, len),
                        Err(err) => {
                            *state_cloned.lock().await = TaskState::Errored(err.to_string());;
                            (true, 0)
                        }
                    }
                }
            };

            // should stop or reach eof
            if should_stop || len == 0 {
                reader.into_inner()
            } else {
                let line = line.trim().to_string();
                error!("[{}] capture stderr output: {}", id, line);
                *state_cloned.lock().await = TaskState::Errored(line);

                reader.into_inner()
            }
        });

        *capture_cancellations = Some((stdout_cancellation, stderr_cancellation));

        (stdout_handle, stderr_handle)
    }

    async fn capturing(
        id: uuid::Uuid,
        store: Weak<Mutex<HashMap<uuid::Uuid, Task>>>,
        _app_handle: tauri::AppHandle,
        stdout_handle: JoinHandle<ChildStdout>,
        stderr_handle: JoinHandle<ChildStderr>,
        state: Arc<Mutex<TaskState>>,
        process: Arc<Mutex<Option<Child>>>,
        capture_cancellations: Arc<Mutex<Option<(CancellationToken, CancellationToken)>>>,
    ) {
        let (stdout_handle_result, stderr_handle_result) =
            tokio::join!(stdout_handle, stderr_handle);

        let mut process = process.lock().await;
        let mut state = state.lock().await;
        let capture_cancellations = capture_cancellations.lock().await;

        let (stdout, stderr) = match (stdout_handle_result, stderr_handle_result) {
            (Ok(stdout), Ok(stderr)) => (stdout, stderr),
            _ => {
                Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                error!(
                    "[{}] error occurred while stdout capturing thread exiting, interrupt task",
                    id
                );
                return;
            }
        };

        let process_ref = process.as_mut().unwrap();
        match &*state {
            TaskState::Idle => unreachable!(),
            TaskState::Running => unreachable!(),
            TaskState::Pausing => {
                // okay, for windows, pausing the ffmpeg process,
                // it is only have to write a '\r'(Carriage Return, `0xd` in ASCII table)
                // character to ffmpeg subprocess via stdin.
                // And for resuming, write a '\n'(Line Feed, `0xa` in ASCII table) character
                // to ffmpeg subprocess via stdin could simply make it work.
                #[cfg(windows)]
                {
                    if let Err(err) = process_ref
                        .stdin
                        .as_mut()
                        .unwrap() // safely unwrap
                        .write_all(&[0xd])
                        .await
                    {
                        Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                        *state = TaskState::Errored(err.to_string());
                        return;
                    };
                }

                #[cfg(not(windows))]
                {}

                process_ref.stdout = Some(stdout);
                process_ref.stderr = Some(stderr);
                info!("[{}] task paused", id);
            }
            TaskState::Stopped => {
                Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                info!("[{}] task killed and stopped", id);
            }
            TaskState::Finished => {
                Self::clean(process, capture_cancellations, &id, &store).await;
                info!("[{}] task finished", id);
            }
            TaskState::Errored(err) => {
                Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                info!("[{}] task errored and stopped", id);
            }
        }

        info!("[{}] stop subprocess output capturing", id);
    }

    /// Starts watchdog watching around the subprocess.
    ///
    /// stdout and stderr of subprocess are taken out and send to capturing threads,
    /// do not try to use them when watchdog running.
    fn start_watchdog(&mut self) {
        let id = self.id.clone();
        let app_handle = self.app_handle.clone();
        let store = Weak::clone(&self.store);
        let process = Arc::clone(&self.process);
        let state = Arc::clone(&self.state);
        let capture_cancellations = Arc::clone(&self.capture_cancellations);

        tokio::spawn(async move {
            info!("[{}] start subprocess output capturing", id);

            // spawns threads to capture log from stdout and stderr.
            // stdout and stdin are taken out from subprocess
            let (stdout_handle, stderr_handle) = Self::start_capture(
                id.clone(),
                app_handle.clone(),
                Arc::clone(&state),
                Arc::clone(&process),
                Arc::clone(&capture_cancellations),
            )
            .await;

            // waits until capturing threads exit, and do cleanup then.
            Self::capturing(
                id,
                store,
                app_handle,
                stdout_handle,
                stderr_handle,
                state,
                process,
                capture_cancellations,
            )
            .await;
        });
    }
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

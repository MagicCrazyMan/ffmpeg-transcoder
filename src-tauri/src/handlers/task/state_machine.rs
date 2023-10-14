use std::{process::Stdio, sync::Arc};

use async_trait::async_trait;
use log::{info, trace, warn};
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStderr, ChildStdout, Command},
    sync::Mutex,
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;

use crate::handlers::{
    error::Error,
    task::message::{TaskMessage, TaskRunningMessage, TASK_MESSAGE_EVENT},
};

use super::task::Task;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum TaskStateCode {
    Idle,
    Running,
    Pausing,
    Stopped,
    Finished,
    Errored,
}

#[async_trait]
pub(super) trait TaskStateMachineNode: Send {
    fn state_code(&self) -> TaskStateCode;

    fn message(&self) -> Option<&str>;

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode>;

    async fn pause(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode>;

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode>;

    async fn stop(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode>;

    async fn finish(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode>;

    async fn error(
        self: Box<Self>,
        item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode>;
}

pub(super) struct Idle;

#[async_trait]
impl TaskStateMachineNode for Idle {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Idle
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        let mut command = Command::new(&item.data.program);

        #[cfg(windows)]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        };

        let process = command
            .args(&item.data.args)
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|err| match err.kind() {
                std::io::ErrorKind::NotFound => Error::ffmpeg_not_found(&item.data.program),
                _ => Error::ffmpeg_unavailable_with_raw_error(&item.data.program, err),
            });
        let process = match process {
            Ok(process) => Arc::new(Mutex::new(process)),
            Err(err) => {
                return Box::new(Errored::from_err(err));
            }
        };

        let watchdog_cancellations = (CancellationToken::new(), CancellationToken::new());
        let watchdog_handle = start_watchdog(
            Arc::clone(&process),
            item.clone(),
            watchdog_cancellations.clone(),
        );

        let next_state = Box::new(Running {
            process,
            watchdog_cancellations,
            watchdog_handle,
        });

        info!(
            "[{}] start task with command: {} {}",
            item.data.id,
            item.data.program,
            item.data
                .args
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

    async fn pause(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a not start task", item.data.id);
        self
    }

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a not start task", item.data.id);
        self
    }

    async fn stop(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        Box::new(Stopped)
    }

    async fn finish(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to finish a not start task", item.data.id);
        self
    }

    async fn error(
        self: Box<Self>,
        _item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode> {
        Box::new(Errored::from_string(reason))
    }
}

pub(super) struct Running {
    process: Arc<Mutex<Child>>,
    watchdog_cancellations: (CancellationToken, CancellationToken),
    watchdog_handle: JoinHandle<()>,
}

#[async_trait]
impl TaskStateMachineNode for Running {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Running
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a running task", item.data.id);
        self
    }

    async fn pause(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        let process = self.process;

        #[cfg(windows)]
        {
            if let Err(err) = process
                .lock()
                .await
                .stdin
                .as_mut()
                .unwrap()
                .write_all(&[0xd])
                .await
            {
                return Box::new(Errored::from_err(err));
            }
        }

        #[cfg(not(windows))]
        {}

        self.watchdog_cancellations.0.cancel();
        self.watchdog_cancellations.1.cancel();

        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Pausing { process })
        }
    }

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a running task", item.data.id);
        self
    }

    async fn stop(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        let mut process = self.process.lock().await;
        let kill = async {
            process.start_kill()?;
            process.wait().await
        };
        if let Err(err) = kill.await {
            return Box::new(Errored::from_err(err));
        };
        // MUST drop here, or watchdog_handle can NEVER get mutex lock of process
        drop(process);

        self.watchdog_cancellations.0.cancel();
        self.watchdog_cancellations.1.cancel();
        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Stopped)
        }
    }

    async fn finish(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        self.watchdog_cancellations.0.cancel();
        self.watchdog_cancellations.1.cancel();
        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Finished)
        }
    }

    async fn error(
        self: Box<Self>,
        item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode> {
        let stopped = self.stop(item).await;
        if stopped.state_code() == TaskStateCode::Stopped {
            Box::new(Errored::from_string(reason))
        } else {
            stopped
        }
    }
}

pub(super) struct Pausing {
    process: Arc<Mutex<Child>>,
}

#[async_trait]
impl TaskStateMachineNode for Pausing {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Pausing
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a pausing task", item.data.id);
        self
    }

    async fn pause(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a pausing task", item.data.id);
        self
    }

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        let process = self.process;

        #[cfg(windows)]
        {
            if let Err(err) = process
                .lock()
                .await
                .stdin
                .as_mut()
                .unwrap()
                .write_all(&[0xa])
                .await
            {
                return Box::new(Errored::from_err(err));
            }
        }

        #[cfg(not(windows))]
        {}

        let watchdog_cancellations = (CancellationToken::new(), CancellationToken::new());
        let watchdog_handle = start_watchdog(
            Arc::clone(&process),
            item.clone(),
            watchdog_cancellations.clone(),
        );

        Box::new(Running {
            process,
            watchdog_cancellations,
            watchdog_handle,
        })
    }

    async fn stop(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        let mut process = self.process.lock().await;
        let kill = async {
            process.start_kill()?;
            process.wait().await
        };
        if let Err(err) = kill.await {
            return Box::new(Errored::from_err(err));
        };

        Box::new(Stopped)
    }

    async fn finish(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to finish a pausing task", item.data.id);
        self
    }

    async fn error(
        self: Box<Self>,
        item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode> {
        let stopped = self.stop(item).await;
        if stopped.state_code() == TaskStateCode::Stopped {
            Box::new(Errored::from_string(reason))
        } else {
            stopped
        }
    }
}

pub(super) struct Stopped;

#[async_trait]
impl TaskStateMachineNode for Stopped {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Stopped
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a stopped task", item.data.id);
        self
    }

    async fn pause(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a stopped task", item.data.id);
        self
    }

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a stopped task", item.data.id);
        self
    }

    async fn stop(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        self
    }

    async fn finish(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to finish a stopped task", item.data.id);
        self
    }

    async fn error(
        self: Box<Self>,
        item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode> {
        warn!(
            "[{}] attempting to error a stopped task, reason: {}",
            item.data.id, reason
        );
        self
    }
}

pub(super) struct Errored {
    pub(super) reason: String,
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
impl TaskStateMachineNode for Errored {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Errored
    }

    fn message(&self) -> Option<&str> {
        Some(self.reason.as_str())
    }

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a errored task", item.data.id);
        self
    }

    async fn pause(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a errored task", item.data.id);
        self
    }

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a errored task", item.data.id);
        self
    }

    async fn stop(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to stop a errored task", item.data.id);
        self
    }

    async fn finish(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to finish a errored task", item.data.id);
        self
    }

    async fn error(
        self: Box<Self>,
        item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode> {
        warn!(
            "[{}] attempting to change error of a errored task, reason: {}",
            item.data.id, reason
        );
        self
    }
}

pub(super) struct Finished;

#[async_trait]
impl TaskStateMachineNode for Finished {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Finished
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a finished task", item.data.id);
        self
    }

    async fn pause(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a finished task", item.data.id);
        self
    }

    async fn resume(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a finished task", item.data.id);
        self
    }

    async fn stop(self: Box<Self>, item: Task) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to stop a finished task", item.data.id);
        self
    }

    async fn finish(self: Box<Self>, _item: Task) -> Box<dyn TaskStateMachineNode> {
        self
    }

    async fn error(
        self: Box<Self>,
        item: Task,
        reason: String,
    ) -> Box<dyn TaskStateMachineNode> {
        warn!(
            "[{}] attempting to error a finished task, reason: {}",
            item.data.id, reason
        );
        self
    }
}

async fn start_capture(
    process: Arc<Mutex<Child>>,
    item: Task,
    watchdog_cancellations: (CancellationToken, CancellationToken),
) -> (
    JoinHandle<(ChildStdout, Result<bool, String>)>,
    JoinHandle<(ChildStderr, Result<(), String>)>,
) {
    let (stdout, stderr) = {
        let mut process = process.lock().await;
        let stdout = process.stdout.take().unwrap(); // safely unwrap
        let stderr = process.stderr.take().unwrap(); // safely unwrap

        (stdout, stderr)
    };

    // spawn a thread to capture stdout
    let state_cloned = Arc::clone(&item.state);
    let stdout_cancellation_cloned = watchdog_cancellations.0.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut line = String::new();
        let mut reader = BufReader::new(stdout);
        let mut message =
            TaskRunningMessage::new(item.data.id.to_string(), item.data.total_duration);
        let result = loop {
            // check state
            if state_cloned.lock().await.as_ref().unwrap().state_code() != TaskStateCode::Running {
                break Ok(false);
            }

            // read from stdout
            let len = tokio::select! {
                _ = stdout_cancellation_cloned.cancelled() => {
                    break Ok(false);
                }
                len = reader.read_line(&mut line) => {
                    match len {
                        Ok(len) =>  len,
                        Err(err) => {
                            match err.kind() {
                                std::io::ErrorKind::UnexpectedEof => break Ok(false),
                                _ => break Err(err.to_string()),
                            }
                        },
                    }
                }
            };

            // should stop or reach eof
            if len == 0 {
                break Ok(false);
            }

            let trimmed_line = line.trim();
            trace!("[{}] capture stdout output: {}", item.data.id, trimmed_line);

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
                        let (finished, msg) = match value {
                            "continue" => (false, Some(TaskMessage::running(&message))),
                            "end" => (true, Some(TaskMessage::running(&message))),
                            _ => (false, None),
                        };

                        // send message if a single frame collected
                        if let Some(msg) = msg {
                            match item.data.app_handle.emit_all(TASK_MESSAGE_EVENT, &msg) {
                                Ok(_) => trace!("[{}] send message to frontend", item.data.id),
                                Err(err) => break Err(err.to_string()),
                            }

                            message.clear();
                        }

                        if finished {
                            break Ok(true);
                        }
                    }
                    _ => {}
                }

                line.clear();
            };
        };

        (reader.into_inner(), result)
    });

    // spawn a thread to capture stderr
    let stderr_cancellation_cloned = watchdog_cancellations.1.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut line = String::new();
        let mut reader = BufReader::new(stderr);

        // read from stdout
        let len = tokio::select! {
            _ = stderr_cancellation_cloned.cancelled() => {
                return (reader.into_inner(), Ok(()));
            }
            len = reader.read_line(&mut line) => {
                match len {
                    Ok(len) => len,
                    Err(err) => {
                        match err.kind() {
                            std::io::ErrorKind::UnexpectedEof => return (reader.into_inner(), Ok(())),
                            _ => return (reader.into_inner(), Err(err.to_string())),
                        }
                    },
                }
            }
        };

        // should stop or reach eof
        if len == 0 {
            (reader.into_inner(), Ok(()))
        } else {
            (reader.into_inner(), Err(line.trim().to_string()))
        }
    });

    (stdout_handle, stderr_handle)
}

fn start_watchdog(
    process: Arc<Mutex<Child>>,
    task: Task,
    watchdog_cancellations: (CancellationToken, CancellationToken),
) -> JoinHandle<()> {
    tokio::spawn(async move {
        info!("[{}] start subprocess output capturing", task.data.id);

        // spawns threads to capture log from stdout and stderr.
        // stdout and stdin are taken out from subprocess
        let (stdout_handle, stderr_handle) =
            start_capture(Arc::clone(&process), task.clone(), watchdog_cancellations).await;

        // waits for watchdog finished
        let (stdout_handle_result, stderr_handle_result) =
            tokio::join!(stdout_handle, stderr_handle);

        let mut process = process.lock().await;
        let ((stdout, stdout_result), (stderr, stderr_result)) =
            match (stdout_handle_result, stderr_handle_result) {
                (Ok(stdout_handle_result), Ok(stderr_handle_result)) => {
                    (stdout_handle_result, stderr_handle_result)
                }
                (Err(err), Ok(_)) => {
                    let reason = format!("stdout handle exited failure: {err}");
                    tokio::spawn(async move { task.error(reason).await });
                    return;
                }
                (Ok(_), Err(err)) => {
                    let reason = format!("stderr handle exited failure: {err}");
                    tokio::spawn(async move { task.error(reason).await });
                    return;
                }
                (Err(err0), Err(err1)) => {
                    let reason = format!(
                        "stdout handle exited failure: {err0}. stderr handle exited failure: {err1}"
                    );
                    tokio::spawn(async move { task.error(reason).await });
                    return;
                }
            };
        process.stdout = Some(stdout);
        process.stderr = Some(stderr);

        match (stdout_result, stderr_result) {
            (Ok(finished), Ok(_)) => {
                if finished {
                    tokio::spawn(async move { task.finish().await });
                } else {
                    // pause, do nothing
                }
            }
            (Ok(_), Err(err)) => {
                let reason = format!("stderr capturing thread exited failure: {err}");
                tokio::spawn(async move { task.error(reason).await });
            }
            (Err(err), Ok(_)) => {
                let reason = format!("stdout capturing thread exited failure: {err}");
                tokio::spawn(async move { task.error(reason).await });
            }
            (Err(err0), Err(err1)) => {
                let reason = format!("stdout capturing thread exited failure: {err0}. stderr capturing thread exited failure: {err1}");
                tokio::spawn(async move { task.error(reason).await });
            }
        }
    })
}

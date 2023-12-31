use std::{path::PathBuf, process::Stdio, sync::Arc, time::Duration};

use async_trait::async_trait;
use log::{info, trace, warn};
use tauri::Manager;
use tokio::{
    fs,
    io::{AsyncBufReadExt, BufReader},
    process::{Child, ChildStderr, ChildStdout},
    sync::Mutex,
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;

use crate::handlers::{
    commands::process::create_process,
    error::Error,
    tasks::{
        message::{TaskMessage, TaskRunningMessage, TASK_MESSAGE_EVENT},
        progress::{find_progress_type, ProgressType},
    },
};

use super::task::Task;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskStateCode {
    Idle,
    Running,
    Pausing,
    Stopped,
    Finished,
    Errored,
}

#[async_trait]
pub trait TaskState: Send {
    fn code(&self) -> TaskStateCode;

    fn message(&self) -> Option<&str>;

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState>;

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState>;

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState>;

    async fn stop(self: Box<Self>, task: Task) -> Box<dyn TaskState>;

    async fn finish(self: Box<Self>, task: Task) -> Box<dyn TaskState>;

    async fn error(self: Box<Self>, task: Task, reason: String) -> Box<dyn TaskState>;
}

pub struct Idle;

impl Idle {
    /// Creates parent directories for all output paths.
    async fn mkdirs(task: &Task) -> Result<(), std::io::Error> {
        for output in task.data.args.outputs.iter() {
            let parent = output.path.as_ref().and_then(|path| {
                PathBuf::from(path)
                    .parent()
                    .map(|parent| parent.to_path_buf())
            });
            match parent {
                Some(path) => {
                    if !path.is_dir() {
                        fs::create_dir_all(path).await?;
                    }
                }
                None => continue,
            }
        }

        Ok(())
    }
}

#[async_trait]
impl TaskState for Idle {
    fn code(&self) -> TaskStateCode {
        TaskStateCode::Idle
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        // find maximum duration from all inputs
        let progress_type = match find_progress_type(&task).await {
            Ok(total_duration) => total_duration,
            Err(err) => return Box::new(Errored::from_err(err)),
        };

        // create directories if not exist
        if let Err(err) = Idle::mkdirs(&task).await {
            return Box::new(Errored::from_err(err));
        };

        // startup ffmpeg subprocess
        let args = task.data.args.to_cli_args();
        let mut command = create_process(&task.data.ffmpeg_program, &args);
        let process = command
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|err| match err.kind() {
                std::io::ErrorKind::NotFound => Error::ffmpeg_not_found(&task.data.ffmpeg_program),
                _ => Error::ffmpeg_unavailable_with_raw_error(&task.data.ffmpeg_program, err),
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
            watchdog_cancellations.clone(),
            task.clone(),
            progress_type,
        );

        let next_state = Box::new(Running {
            progress_type,
            process,
            watchdog_cancellations,
            watchdog_handle,
        });

        info!(
            "[{}] start task with command: {} {}",
            task.data.id,
            task.data.ffmpeg_program,
            args.iter()
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

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to pause a not start task", task.data.id);
        self
    }

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to resume a not start task", task.data.id);
        self
    }

    async fn stop(self: Box<Self>, _task: Task) -> Box<dyn TaskState> {
        Box::new(Stopped)
    }

    async fn finish(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to finish a not start task", task.data.id);
        self
    }

    async fn error(self: Box<Self>, _task: Task, reason: String) -> Box<dyn TaskState> {
        Box::new(Errored::from_string(reason))
    }
}

pub struct Running {
    progress_type: ProgressType,
    process: Arc<Mutex<Child>>,
    watchdog_cancellations: (CancellationToken, CancellationToken),
    watchdog_handle: JoinHandle<()>,
}

#[async_trait]
impl TaskState for Running {
    fn code(&self) -> TaskStateCode {
        TaskStateCode::Running
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to start a running task", task.data.id);
        self
    }

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        self.watchdog_cancellations.0.cancel();
        self.watchdog_cancellations.1.cancel();
        if let Err(err) = self.watchdog_handle.await {
            return Box::new(Errored::from_err(err));
        }

        let process = self.process;
        #[cfg(windows)]
        {
            use tokio::io::AsyncWriteExt;
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

        #[cfg(unix)]
        {
            use nix::{
                sys::signal::{self, Signal},
                unistd::Pid,
            };

            let pid = match process
                .lock()
                .await
                .id()
                .and_then(|pid| pid.try_into().ok())
            {
                Some(pid) => pid,
                None => return Box::new(Errored::from_err(Error::FFmpegPidNotFound)),
            };

            if let Err(raw_error) = signal::kill(Pid::from_raw(pid), Signal::SIGSTOP) {
                return Box::new(Errored::from_err(Error::FFmpegSignalError { raw_error }));
            }
        }

        info!("[{}] task pause", task.data.id);

        Box::new(Pausing {
            progress_type: self.progress_type,
            process,
        })
    }

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to resume a running task", task.data.id);
        self
    }

    async fn stop(self: Box<Self>, _task: Task) -> Box<dyn TaskState> {
        self.watchdog_cancellations.0.cancel();
        self.watchdog_cancellations.1.cancel();
        if let Err(err) = self.watchdog_handle.await {
            return Box::new(Errored::from_err(err));
        }

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

        Box::new(Stopped)
    }

    async fn finish(self: Box<Self>, _task: Task) -> Box<dyn TaskState> {
        self.watchdog_cancellations.0.cancel();
        self.watchdog_cancellations.1.cancel();
        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Finished)
        }
    }

    async fn error(self: Box<Self>, task: Task, reason: String) -> Box<dyn TaskState> {
        let stopped = self.stop(task).await;
        if stopped.code() == TaskStateCode::Stopped {
            Box::new(Errored::from_string(reason))
        } else {
            stopped
        }
    }
}

pub struct Pausing {
    progress_type: ProgressType,
    process: Arc<Mutex<Child>>,
}

#[async_trait]
impl TaskState for Pausing {
    fn code(&self) -> TaskStateCode {
        TaskStateCode::Pausing
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to start a pausing task", task.data.id);
        self
    }

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to pause a pausing task", task.data.id);
        self
    }

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        let process = self.process;

        #[cfg(windows)]
        {
            use tokio::io::AsyncWriteExt;
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

        #[cfg(unix)]
        {
            use nix::{
                sys::signal::{self, Signal},
                unistd::Pid,
            };

            let pid = match process
                .lock()
                .await
                .id()
                .and_then(|pid| pid.try_into().ok())
            {
                Some(pid) => pid,
                None => return Box::new(Errored::from_err(Error::FFmpegPidNotFound)),
            };

            if let Err(raw_error) = signal::kill(Pid::from_raw(pid), Signal::SIGCONT) {
                return Box::new(Errored::from_err(Error::FFmpegSignalError { raw_error }));
            }
        }

        let watchdog_cancellations = (CancellationToken::new(), CancellationToken::new());
        let watchdog_handle = start_watchdog(
            Arc::clone(&process),
            watchdog_cancellations.clone(),
            task.clone(),
            self.progress_type,
        );

        info!("[{}] task resume", task.data.id);

        Box::new(Running {
            progress_type: self.progress_type,
            process,
            watchdog_cancellations,
            watchdog_handle,
        })
    }

    async fn stop(self: Box<Self>, _task: Task) -> Box<dyn TaskState> {
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

    async fn finish(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to finish a pausing task", task.data.id);
        self
    }

    async fn error(self: Box<Self>, task: Task, reason: String) -> Box<dyn TaskState> {
        let stopped = self.stop(task).await;
        if stopped.code() == TaskStateCode::Stopped {
            Box::new(Errored::from_string(reason))
        } else {
            stopped
        }
    }
}

pub struct Stopped;

#[async_trait]
impl TaskState for Stopped {
    fn code(&self) -> TaskStateCode {
        TaskStateCode::Stopped
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to start a stopped task", task.data.id);
        self
    }

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to pause a stopped task", task.data.id);
        self
    }

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to resume a stopped task", task.data.id);
        self
    }

    async fn stop(self: Box<Self>, _task: Task) -> Box<dyn TaskState> {
        self
    }

    async fn finish(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to finish a stopped task", task.data.id);
        self
    }

    async fn error(self: Box<Self>, task: Task, reason: String) -> Box<dyn TaskState> {
        warn!(
            "[{}] attempting to error a stopped task, reason: {}",
            task.data.id, reason
        );
        self
    }
}

pub struct Errored {
    pub reason: String,
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
impl TaskState for Errored {
    fn code(&self) -> TaskStateCode {
        TaskStateCode::Errored
    }

    fn message(&self) -> Option<&str> {
        Some(self.reason.as_str())
    }

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to start a errored task", task.data.id);
        self
    }

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to pause a errored task", task.data.id);
        self
    }

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to resume a errored task", task.data.id);
        self
    }

    async fn stop(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to stop a errored task", task.data.id);
        self
    }

    async fn finish(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to finish a errored task", task.data.id);
        self
    }

    async fn error(self: Box<Self>, task: Task, reason: String) -> Box<dyn TaskState> {
        warn!(
            "[{}] attempting to change error of a errored task, reason: {}",
            task.data.id, reason
        );
        self
    }
}

pub struct Finished;

#[async_trait]
impl TaskState for Finished {
    fn code(&self) -> TaskStateCode {
        TaskStateCode::Finished
    }

    fn message(&self) -> Option<&str> {
        None
    }

    async fn start(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to start a finished task", task.data.id);
        self
    }

    async fn pause(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to pause a finished task", task.data.id);
        self
    }

    async fn resume(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to resume a finished task", task.data.id);
        self
    }

    async fn stop(self: Box<Self>, task: Task) -> Box<dyn TaskState> {
        warn!("[{}] attempting to stop a finished task", task.data.id);
        self
    }

    async fn finish(self: Box<Self>, _task: Task) -> Box<dyn TaskState> {
        self
    }

    async fn error(self: Box<Self>, task: Task, reason: String) -> Box<dyn TaskState> {
        warn!(
            "[{}] attempting to error a finished task, reason: {}",
            task.data.id, reason
        );
        self
    }
}

fn start_capture(
    stdout: ChildStdout,
    stderr: ChildStderr,
    watchdog_cancellations: (CancellationToken, CancellationToken),
    task: Task,
    progress_type: ProgressType,
) -> (
    JoinHandle<(ChildStdout, Result<bool, Error>)>,
    JoinHandle<(ChildStderr, Result<(), Error>)>,
) {
    // spawn a thread to capture stdout
    let state_cloned = Arc::clone(&task.state);
    let stdout_cancellation_cloned = watchdog_cancellations.0.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut line = String::new();
        let mut reader = BufReader::new(stdout);
        let mut message = TaskRunningMessage::new(task.data.id.to_string(), progress_type);
        let result = loop {
            // check state
            if state_cloned.lock().await.as_ref().unwrap().code() != TaskStateCode::Running {
                break Ok(false);
            }

            // read from stdout
            let len = tokio::select! {
                _ = stdout_cancellation_cloned.cancelled() => {
                    break Ok(false);
                }
                len = reader.read_line(&mut line) => {
                    match len {
                        Ok(len) => len,
                        Err(err) => {
                            match err.kind() {
                                std::io::ErrorKind::UnexpectedEof => break Err(Error::ffmpeg_unexpected_killed()),
                                _ => break Err(Error::internal(err)),
                            }
                        },
                    }
                }
            };

            // should stop or reach eof
            if len == 0 {
                break Err(Error::ffmpeg_unexpected_killed());
            }

            let trimmed_line = line.trim();
            trace!("[{}] capture stdout output: {}", task.data.id, trimmed_line);

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
                            match task.data.app_handle.emit_all(TASK_MESSAGE_EVENT, &msg) {
                                Ok(_) => trace!("[{}] send message to frontend", task.data.id),
                                Err(err) => break Err(Error::internal(err)),
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
    // stderr capturing should not report any process error, only ffmpeg runtime error should be thrown
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
                            _ => return (reader.into_inner(), Ok(())),
                        }
                    },
                }
            }
        };

        // stop if capturing any error output or reach eof
        if len == 0 {
            (reader.into_inner(), Ok(()))
        } else {
            let line = line.trim();

            // checks ignore list
            // any stderr starts with text in ignore list does not regard as error
            static STARTS_WITH_IGNORES: [&'static str; 2] = ["x264", "x265"];
            if STARTS_WITH_IGNORES.iter().any(|str| line.starts_with(str)) {
                (reader.into_inner(), Ok(()))
            } else {
                (reader.into_inner(), Err(Error::ffmpeg_runtime_error(line)))
            }
        }
    });

    (stdout_handle, stderr_handle)
}

enum ProcessStatus {
    PauseOrFinish(
        Result<(ChildStdout, Result<bool, Error>), tokio::task::JoinError>,
        Result<(ChildStderr, Result<(), Error>), tokio::task::JoinError>,
    ),
    Exit,
    Killed(Error),
}

fn start_watchdog(
    process: Arc<Mutex<Child>>,
    watchdog_cancellations: (CancellationToken, CancellationToken),
    task: Task,
    progress_type: ProgressType,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        info!("[{}] start subprocess output capturing", task.data.id);

        let mut process = process.lock().await;

        let stdout = process.stdout.take().unwrap(); // safely unwrap
        let stderr = process.stderr.take().unwrap(); // safely unwrap

        // strange bug, stdin becomes None when trying to pause a running job.
        // only takes it out here and puts it back when watchdog stopping could make it works.
        let stdin = process.stdin.take().unwrap(); // safely unwrap

        // spawns threads to capture log from stdout and stderr.
        // stdout and stdin are taken out from subprocess
        let (stdout_handle, stderr_handle) = start_capture(
            stdout,
            stderr,
            watchdog_cancellations,
            task.clone(),
            progress_type,
        );

        // waits for watchdog finished or process killed
        let status = tokio::select! {
            handles = tokio::spawn(async move { tokio::join!(stdout_handle, stderr_handle) }) => {
                match handles {
                    Ok((h1, h2)) => ProcessStatus::PauseOrFinish(h1, h2),
                    Err(err) => ProcessStatus::Killed(Error::internal(err))
                }
            },
            status = process.wait() => {
                // waits for 50 milliseconds to ensure stderr finish first
                tokio::time::sleep(Duration::from_millis(50)).await;
                match status {
                    Ok(status) => {
                        if status.success() {
                            ProcessStatus::Exit
                        } else {
                            ProcessStatus::Killed(Error::ffmpeg_unexpected_killed())
                        }
                    },
                    Err(err) => ProcessStatus::Killed(Error::internal(err))
                }
            },
        };

        match status {
            ProcessStatus::PauseOrFinish(stdout_handle_result, stderr_handle_result) => {
                let ((stdout, stdout_result), (stderr, stderr_result)) = match (
                    stdout_handle_result,
                    stderr_handle_result,
                ) {
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
                process.stdin = Some(stdin);

                match (stdout_result, stderr_result) {
                    (Ok(finished), Ok(_)) => {
                        if finished {
                            tokio::spawn(async move { task.finish().await });
                        } else {
                            // pause, do nothing
                        }
                    }
                    (Err(err), Ok(_)) => {
                        let reason = err.to_string();
                        tokio::spawn(async move { task.error(reason).await });
                    }
                    (Ok(_), Err(err)) | (Err(_), Err(err)) => {
                        // sends stderr error also if both handles throw errors
                        let reason = err.to_string();
                        tokio::spawn(async move { task.error(reason).await });
                    }
                }
            }
            ProcessStatus::Exit => {
                // do nothing, waits for watchdog stops and send finish event there
            }
            ProcessStatus::Killed(err) => {
                // unexpected killed
                let reason = err.to_string();
                tokio::spawn(async move { task.error(reason).await });
            }
        }
    })
}

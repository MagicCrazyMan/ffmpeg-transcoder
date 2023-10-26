use std::{
    ffi::OsStr,
    path::PathBuf,
    process::Stdio,
    sync::{Arc, OnceLock},
};

use async_trait::async_trait;
use log::{info, trace, warn};
use regex::Regex;
use tauri::Manager;
use tokio::{
    fs,
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStderr, ChildStdout},
    sync::Mutex,
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;

use crate::{
    handlers::{
        commands::process::{create_process, invoke_ffprobe},
        error::Error,
        tasks::message::{TaskMessage, TaskRunningMessage, TASK_MESSAGE_EVENT},
    },
    with_default_args,
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
    /// Finds max duration from all inputs.
    async fn find_max_duration(task: &Task) -> Result<f64, Error> {
        let mut input_max_duration: f64 = 0.0;

        // find max duration(clipping applied) from all inputs
        for input in task.data.args.inputs.iter() {
            let raw = invoke_ffprobe(
                &task.data.ffprobe_program,
                with_default_args!(
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "csv=p=0",
                    &input.path
                ),
            )
            .await?;

            let Ok(duration) = String::from_utf8_lossy(&raw.stdout).trim().parse::<f64>() else {
                continue;
            };

            // applies clipping
            let duration = match Self::find_clipping_args(&input.args) {
                (None, None, None, None) => duration,
                (None, None, _, Some(t)) => t.min(duration),
                (None, None, Some(to), None) => to.min(duration),
                (None, Some(sseof), None, None) => {
                    if sseof > 0.0 {
                        0.0 // error
                    } else {
                        duration + sseof
                    }
                }
                (None, Some(sseof), _, Some(t)) => {
                    if sseof > 0.0 {
                        0.0 // error
                    } else {
                        let ss = duration + sseof;
                        let to = (ss + t).min(duration);

                        to - ss
                    }
                }
                (None, Some(sseof), Some(to), None) => {
                    if sseof > 0.0 {
                        0.0 // error
                    } else {
                        let ss = duration + sseof;
                        let to = to.min(duration);

                        if ss > to {
                            sseof.abs()
                        } else {
                            to - ss
                        }
                    }
                }
                (Some(ss), None, None, None) => duration - ss,
                (Some(ss), _, _, Some(t)) => {
                    let ss = ss.min(duration);
                    let to = (ss + t).min(duration);
                    to - ss
                }
                (Some(ss), _, Some(to), None) => {
                    if ss > to {
                        0.0 // error
                    } else {
                        if ss < 0.0 {
                            // strange behavior done by ffmpeg, i don't know why as well
                            ss.abs() * 2.0 + to
                        } else {
                            let ss = ss.min(duration);
                            let to = to.min(duration);
                            to - ss
                        }
                    }
                }
                (Some(ss), Some(_), None, None) => duration - ss.min(duration),
            };

            input_max_duration = input_max_duration.max(duration);
        }

        // find min duration from all outputs
        let mut output_min_duration: f64 = input_max_duration;
        for output in task.data.args.outputs.iter() {
            // -sseof not works on output
            let (ss, _, to, t) = Self::find_clipping_args(&output.args);
            let duration = match (ss, to, t) {
                (None, None, None) => continue,
                (_, _, Some(t)) => t,
                (None, Some(to), None) => to,
                // ffmpeg prints nothing before reaching -ss position
                (Some(ss), None, None) => input_max_duration - ss,
                (Some(ss), Some(to), None) => to - ss,
            };

            if duration < output_min_duration {
                output_min_duration = duration
            }
        }

        Ok(input_max_duration.min(output_min_duration))
    }

    /// Finds arguments that used for clipping, in (-ss, -sseof, -to, -t) order.
    fn find_clipping_args<I, S>(args: I) -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>)
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut ss: Option<f64> = None;
        let mut sseof: Option<f64> = None;
        let mut to: Option<f64> = None;
        let mut t: Option<f64> = None;

        let mut iter = args.into_iter();
        while let Some(arg) = iter.next() {
            let arg = arg.as_ref().to_string_lossy();
            let arg = arg.as_ref();

            let value = match arg {
                "-ss" | "-sseof" | "-to" | "-t" => {
                    let Some(value) = iter.next() else {
                        break;
                    };
                    value
                }
                _ => {
                    continue;
                }
            };

            match arg {
                "-ss" => {
                    ss = Self::extract_duration(value);
                }
                "-sseof" => {
                    sseof = Self::extract_duration(value);
                }
                "-to" => {
                    to = Self::extract_duration(value);
                }
                "-t" => {
                    t = Self::extract_duration(value);
                }
                _ => {}
            };
        }

        (ss, sseof, to, t)
    }

    /// Extracts duration in seconds from value.
    ///
    /// Sees [FFmpeg document](https://ffmpeg.org/ffmpeg-utils.html#time-duration-syntax)
    /// and [FFmpeg utils](https://ffmpeg.org/ffmpeg-utils.html#time-duration-syntax)
    /// for more details.
    fn extract_duration<S: AsRef<OsStr>>(value: S) -> Option<f64> {
        static DURATION_TYPE1_EXTRACTOR: &'static str =
            r"^(-?)(?:(\d+):{1})?(\d{1,2}):(\d{1,2})(?:\.{1}(\d+))?$";
        static DURATION_TYPE2_EXTRACTOR: &'static str = r"^(-?)(\d+)(?:\.{1}(\d+))?(s|ms|us?)?$";
        static DURATION_TYPE1_REGEX: OnceLock<Regex> = OnceLock::new();
        static DURATION_TYPE2_REGEX: OnceLock<Regex> = OnceLock::new();

        let value = value.as_ref().to_string_lossy();
        let value = value.as_ref();

        // tries to extract duration by type 1
        let duration_type1_regex =
            DURATION_TYPE1_REGEX.get_or_init(|| Regex::new(DURATION_TYPE1_EXTRACTOR).unwrap());
        let duration = duration_type1_regex.captures(value).and_then(|caps| {
            if let (negative, hours, Some(mins), Some(secs), milliseconds) = (
                caps.get(1)
                    .map(|value| if value.as_str() == "-" { true } else { false }),
                caps.get(2)
                    .and_then(|value| value.as_str().parse::<f64>().ok()),
                caps.get(3)
                    .and_then(|value| value.as_str().parse::<f64>().ok()),
                caps.get(4)
                    .and_then(|value| value.as_str().parse::<f64>().ok()),
                caps.get(5)
                    .and_then(|value| value.as_str().parse::<f64>().ok()),
            ) {
                let mut secs = hours.unwrap_or(0.0) * 3600.0
                    + mins * 60.0
                    + secs
                    + milliseconds.unwrap_or(0.0) / 1000.0;

                if negative.unwrap_or(false) {
                    secs = -secs
                }

                Some(secs)
            } else {
                None
            }
        });

        if duration.is_some() {
            return duration;
        }

        // tries to extract duration by type 2
        enum Unit {
            Second,
            Milliseconds,
            Microseconds,
            Unknown,
        }
        let duration_type2_regex =
            DURATION_TYPE2_REGEX.get_or_init(|| Regex::new(DURATION_TYPE2_EXTRACTOR).unwrap());
        let duration = duration_type2_regex.captures(value).and_then(|caps| {
            if let (negative, Some(integer), decimals, unit) = (
                caps.get(1)
                    .map(|value| if value.as_str() == "-" { true } else { false }),
                caps.get(2)
                    .and_then(|value| value.as_str().parse::<f64>().ok()),
                caps.get(3)
                    .and_then(|value| value.as_str().parse::<f64>().ok()),
                caps.get(4)
                    .map(|value| match value.as_str() {
                        "s" => Unit::Second,
                        "ms" => Unit::Milliseconds,
                        "us" => Unit::Microseconds,
                        _ => Unit::Unknown,
                    })
                    .unwrap_or(Unit::Second),
            ) {
                let mut secs = match unit {
                    Unit::Second => integer + decimals.unwrap_or(0.0),
                    Unit::Milliseconds => (integer + decimals.unwrap_or(0.0)) / 1000.0,
                    Unit::Microseconds => (integer + decimals.unwrap_or(0.0)) / 1000000.0,
                    Unit::Unknown => return None,
                };

                if negative.unwrap_or(false) {
                    secs = -secs
                }

                Some(secs)
            } else {
                None
            }
        });

        duration
    }

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
        let total_duration = match Idle::find_max_duration(&task).await {
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
            total_duration,
        );

        let next_state = Box::new(Running {
            total_duration,
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
    total_duration: f64,
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

        info!("[{}] task pause", task.data.id);

        Box::new(Pausing {
            total_duration: self.total_duration,
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
    total_duration: f64,
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
            watchdog_cancellations.clone(),
            task.clone(),
            self.total_duration,
        );

        info!("[{}] task resume", task.data.id);

        Box::new(Running {
            total_duration: self.total_duration,
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
    total_duration: f64,
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
        let mut message = TaskRunningMessage::new(task.data.id.to_string(), total_duration);
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
                                std::io::ErrorKind::UnexpectedEof => break Err(Error::process_unexpected_killed()),
                                _ => break Err(Error::internal(err)),
                            }
                        },
                    }
                }
            };

            // should stop or reach eof
            if len == 0 {
                break Err(Error::process_unexpected_killed());
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
            (reader.into_inner(), Err(Error::ffmpeg_runtime_error(line)))
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
    total_duration: f64,
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
            total_duration,
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
                match status {
                    Ok(status) => {
                        if status.success() {
                            ProcessStatus::Exit
                        } else {
                            ProcessStatus::Killed(Error::process_unexpected_killed())
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

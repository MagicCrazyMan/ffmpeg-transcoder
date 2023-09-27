use std::{
    collections::HashMap,
    process::Stdio,
    sync::{Arc, Weak},
};

use log::{debug, error, info, warn};
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::{Mutex, MutexGuard},
};
use tokio_util::sync::CancellationToken;

use crate::handlers::error::IntoInternalResult;

use super::error::Error;

pub struct TranscodeStore {
    store: Arc<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
}

impl TranscodeStore {
    /// Creates a new transcode store.
    pub fn new() -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Adds and starts a new transcode job.
    /// returning an identifier point to current job.
    pub async fn add_and_start(
        &self,
        app_handle: tauri::AppHandle,
        program: String,
        args: Vec<String>,
    ) -> Result<uuid::Uuid, Error> {
        let id = uuid::Uuid::new_v4();
        let mut job = TranscodeJob::new(
            id.clone(),
            Arc::downgrade(&self.store),
            app_handle,
            program,
            args,
        );

        job.start().await?;
        self.store.lock().await.insert(id.clone(), job);

        Ok(id)
    }

    /// Stops a transcode job.
    pub async fn stop(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(job) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        job.stop().await;
    }

    /// Pauses a transcode job.
    pub async fn pause(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(job) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        job.pause().await;
    }

    /// Resumes a transcode job.
    pub async fn resume(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(job) = store.get_mut(id) else {
            warn!("jon id {} not found", id);
            return;
        };

        job.resume().await;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[repr(u8)]
pub enum TranscodeJobState {
    Idle = 0,
    Running = 1,
    Pausing = 2,
    Stopped = 3,
    Finished = 4,
    Errored = 5,
}

/// A transcode job.
#[derive(Debug)]
pub struct TranscodeJob {
    id: uuid::Uuid,
    store: Weak<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
    program: String,
    args: Vec<String>,
    app_handle: tauri::AppHandle,
    state: Arc<Mutex<TranscodeJobState>>,
    process: Arc<Mutex<Option<Child>>>,
    capture_cancellations: Arc<Mutex<Option<(CancellationToken, CancellationToken)>>>,
}

impl TranscodeJob {
    /// Creates a new transcode job.
    fn new(
        id: uuid::Uuid,
        store: Weak<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
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
            state: Arc::new(Mutex::new(TranscodeJobState::Idle)),
            process: Arc::new(Mutex::new(None)),
            capture_cancellations: Arc::new(Mutex::new(None)),
        }
    }

    /// Starts the job.
    async fn start(&mut self) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        if *state != TranscodeJobState::Idle {
            debug!("[{}] attempting to start a started job", self.id);
            return Ok(());
        }

        let child = Command::new(&self.program)
            .args(&self.args)
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .into_internal_result()?;
        self.process = Arc::new(Mutex::new(Some(child)));
        *state = TranscodeJobState::Running;
        drop(state);

        self.start_watchdog();

        info!(
            "[{}] start job with command: {} {}",
            self.id,
            self.program,
            self.args.join(" ")
        );

        Ok(())
    }

    /// Pauses the job.
    async fn pause(&self) {
        let capture_cancellations = self.capture_cancellations.lock().await;
        let mut state = self.state.lock().await;
        if *state != TranscodeJobState::Running {
            warn!("[{}] attempting to pause a not running job", self.id);
            return;
        }

        *state = TranscodeJobState::Pausing;
        let capture_cancellations = capture_cancellations.as_ref().unwrap(); // safely unwrap
        capture_cancellations.0.cancel();
        capture_cancellations.1.cancel();
    }

    /// Resumes the job.
    async fn resume(&mut self) {
        let mut process = self.process.lock().await;
        let mut state = self.state.lock().await;
        if *state != TranscodeJobState::Pausing {
            warn!("[{}] attempting to resume a not pausing job", self.id);
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
                    "[{}] error occurred while writing to stdin: {}, interrupt job",
                    self.id, err
                );
                self.stop().await;
                return;
            };
        }

        *state = TranscodeJobState::Running;
        drop(state);
        drop(process);

        self.start_watchdog();

        info!("[{}] resume job", self.id);
    }

    /// Stops the job.
    ///
    /// This function does different job for different state:
    /// -
    async fn stop(&self) {
        let mut state = self.state.lock().await;
        match *state {
            TranscodeJobState::Idle => *state = TranscodeJobState::Stopped,
            TranscodeJobState::Running => *state = TranscodeJobState::Stopped,
            TranscodeJobState::Pausing => {
                Self::kill_and_clean(
                    self.process.lock().await,
                    self.capture_cancellations.lock().await,
                    &self.id,
                    &self.store,
                )
                .await;
                info!("[{}] job killed and stopped", self.id);

                *state = TranscodeJobState::Stopped;
            }
            _ => {
                debug!("[{}] attempting to kill a stopped or finished job", self.id);
            }
        };
    }

    async fn kill_and_clean(
        mut process: MutexGuard<'_, Option<Child>>,
        capture_cancellations: MutexGuard<'_, Option<(CancellationToken, CancellationToken)>>,
        id: &uuid::Uuid,
        store: &Weak<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
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
        store: &Weak<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
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
            let (stdout_handle, stderr_handle) = {
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
                    let mut message = TranscodingMessage::new(&id);
                    loop {
                        // check state
                        if *state_cloned.lock().await != TranscodeJobState::Running {
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
                                        *state_cloned.lock().await = TranscodeJobState::Errored;
                                        error!(
                                            "[{}] error occurred while reading subprocess output {}",
                                            id, err
                                        );
                                        (true, 0)
                                    }
                                }
                            }
                        };

                        // should stop or reach eof
                        if should_stop || len == 0 {
                            break;
                        }

                        debug!("[{}] capture stdout output: {}", id, line);

                        // store raw message
                        message.raw.push(line.trim().to_string());

                        // extract key value
                        let mut splitted = line.split("=");
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
                                        message.bitrate =
                                            value[..value.len() - 7].parse::<f64>().ok();
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
                                        message.speed =
                                            value[..value.len() - 1].parse::<f64>().ok();
                                    }
                                }
                                "progress" => {
                                    let send = match value {
                                        "continue" => {
                                            message.progress = TranscodeJobState::Running;
                                            true
                                        }
                                        "end" => {
                                            message.progress = TranscodeJobState::Finished;
                                            true
                                        }
                                        _ => false,
                                    };

                                    // send message if a single frame collected
                                    if send {
                                        match app_handle.emit_all(TRANSCODING_MESSAGE_EVENT, &message) {
                                            Ok(_) => debug!("[{}] send message to frontend", id),
                                            Err(err) => error!(
                                                "[{}] error occurred while emit event to frontend: {}",
                                                id, err
                                            ),
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
                    loop {
                        // check state
                        if *state_cloned.lock().await != TranscodeJobState::Running {
                            break;
                        }

                        // read from stdout
                        let (should_stop, len) = tokio::select! {
                            _ = stderr_cancellation_cloned.cancelled() => {
                                (true, 0)
                            }
                            len = reader.read_line(&mut line) => {
                                match len {
                                    Ok(len) =>  (false, len),
                                    Err(err) => {
                                        *state_cloned.lock().await = TranscodeJobState::Errored;
                                        error!(
                                            "[{}] error occurred while reading subprocess output {}",
                                            id, err
                                        );
                                        (true, 0)
                                    }
                                }
                            }
                        };

                        // should stop or reach eof
                        if should_stop || len == 0 {
                            break;
                        }

                        error!("[{}] capture stderr output: {}", id, line.trim());

                        line.clear();
                    }

                    reader.into_inner()
                });

                *capture_cancellations = Some((stdout_cancellation, stderr_cancellation));

                (stdout_handle, stderr_handle)
            };

            // waits for both handles exit
            let (stdout_handle_result, stderr_handle_result) =
                tokio::join!(stdout_handle, stderr_handle);

            // do clean up, return stdout and stderr back to subprocess
            {
                let mut process = process.lock().await;
                let mut state = state.lock().await;
                let capture_cancellations = capture_cancellations.lock().await;

                let (stdout, stderr) = match (stdout_handle_result, stderr_handle_result) {
                    (Ok(stdout), Ok(stderr)) => (stdout, stderr),
                    _ => {
                        Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                        error!(
                            "[{}] error occurred while stdout capturing thread exiting, interrupt job",
                            id
                        );
                        return;
                    }
                };

                let process_ref = process.as_mut().unwrap();
                match *state {
                    TranscodeJobState::Idle => unreachable!(),
                    TranscodeJobState::Running => unreachable!(),
                    TranscodeJobState::Pausing => {
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
                                Self::kill_and_clean(process, capture_cancellations, &id, &store)
                                    .await;
                                *state = TranscodeJobState::Errored;
                                error!(
                                    "[{}] error occurred while writing to stdin: {}, interrupt job",
                                    id, err
                                );
                                return;
                            };
                        }

                        #[cfg(not(windows))]
                        {}

                        process_ref.stdout = Some(stdout);
                        process_ref.stderr = Some(stderr);
                        info!("[{}] job paused", id);
                    }
                    TranscodeJobState::Stopped => {
                        Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                        info!("[{}] job killed and stopped", id);
                    }
                    TranscodeJobState::Finished => {
                        Self::clean(process, capture_cancellations, &id, &store).await;
                        info!("[{}] job finished", id);
                    }
                    TranscodeJobState::Errored => {
                        Self::kill_and_clean(process, capture_cancellations, &id, &store).await;
                        info!("[{}] job errored and stopped", id);
                    }
                }

                info!("[{}] stop subprocess output capturing", id);
            }
        });
    }
}

static TRANSCODING_MESSAGE_EVENT: &'static str = "transcoding";

/// A message structure transferring transcode progress to frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct TranscodingMessage {
    id: String,
    progress: TranscodeJobState,
    frame: Option<usize>,
    fps: Option<f64>,
    bitrate: Option<f64>,
    total_size: Option<usize>,
    output_time_ms: Option<usize>,
    dup_frames: Option<usize>,
    drop_frames: Option<usize>,
    speed: Option<f64>,
    raw: Vec<String>,
}

impl TranscodingMessage {
    pub fn new(id: &uuid::Uuid) -> Self {
        Self {
            id: id.to_string(),
            progress: TranscodeJobState::Idle,
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

    pub fn clear(&mut self) {
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

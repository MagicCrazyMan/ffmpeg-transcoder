use std::{
    collections::HashMap,
    process::Stdio,
    sync::{Arc, Weak},
};

use log::{debug, error, info, trace, warn};
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::Mutex,
};

use crate::handlers::error::IntoInternalResult;

use super::error::Error;

pub struct TranscodeStore {
    store: Arc<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
}

impl TranscodeStore {
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
    ) -> uuid::Uuid {
        let id = uuid::Uuid::new_v4();
        let mut job = TranscodeJob::new(
            id.clone(),
            Arc::downgrade(&self.store),
            app_handle,
            program,
            args,
        );

        job.start();
        self.store.lock().await.insert(id.clone(), job);

        id
    }

    /// Stops a transcode job.
    pub async fn stop(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(job) = store.get_mut(id) else {
            return;
        };

        job.stop().await;
    }

    /// Pauses a transcode job.
    pub async fn pause(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(job) = store.get_mut(id) else {
            return;
        };

        job.pause().await;
    }

    /// Resumes a transcode job.
    pub async fn resume(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(job) = store.get_mut(id) else {
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
    process: Arc<Mutex<Option<Child>>>,
    app_handle: tauri::AppHandle,
    state: Arc<Mutex<TranscodeJobState>>,
    next_state: Arc<Mutex<Option<TranscodeJobState>>>,
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
            process: Arc::new(Mutex::new(None)),
            app_handle,
            state: Arc::new(Mutex::new(TranscodeJobState::Idle)),
            next_state: Arc::new(Mutex::new(None)),
        }
    }

    /// Starts the job and spawns a thread for capturing output log from subprocess.
    ///
    /// After job started, never try to take the mutex lock of the `process` field.
    /// Because the capturing thread holds the mutex lock during its whole life,
    /// which meaning that it is impossible to get the mutex lock outside the capturing thread.
    /// Changing `next_state` field is the only way to stop or pause the subprocess,
    /// capturing thread will do the clean up itself after subprocess ended.
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

        info!(
            "[{}] start transcode with command: {} {}",
            self.id,
            self.program,
            self.args.join(" ")
        );

        self.start_capture();

        Ok(())
    }

    /// Pauses the job.
    ///
    /// This function only set `next_state` field to [`TranscodeJobState::Pausing`],
    /// the capturing thread will finish the job of pausing.
    async fn pause(&self) {
        let state = self.state.lock().await;
        if *state != TranscodeJobState::Running {
            warn!("[{}] attempting to pause a not running job", self.id);
            return;
        }

        *self.next_state.lock().await = Some(TranscodeJobState::Pausing);
    }

    /// Resumes the job.
    async fn resume(&mut self) {
        let mut state = self.state.lock().await;
        if *state != TranscodeJobState::Pausing {
            warn!("[{}] attempting to resume a not pausing job", self.id);
            return;
        }

        let mut process_lock = self.process.lock().await;
        let Some(process) = process_lock.as_mut() else {
            warn!(
                "[{}] a job has no subprocess but having PAUSING state",
                self.id
            );
            return;
        };

        // write a '\n'(Line Feed, `0xa` in ASCII table) character
        // to ffmpeg subprocess via stdin to resume.
        #[cfg(windows)]
        {
            if let Err(err) = process.stdin.as_mut().unwrap().write_all(&[0xa]).await {
                Self::kill_inner(process, &self.id, &self.store).await;
                error!(
                    "[{}] error occurred while writing to stdin: {}, interrupt job",
                    self.id, err
                );
                return;
            };
        }

        *state = TranscodeJobState::Running;
        drop(state);
        drop(process_lock);

        self.start_capture();
    }

    /// Stops the job.
    ///
    /// This function does different job for different state:
    /// -
    async fn stop(&self) {
        let mut state = self.state.lock().await;
        match *state {
            TranscodeJobState::Idle => *state = TranscodeJobState::Stopped,
            TranscodeJobState::Running => {
                *self.next_state.lock().await = Some(TranscodeJobState::Stopped)
            }
            TranscodeJobState::Pausing => {
                let process = self.process.lock().await.take();
                match process {
                    Some(mut process) => {
                        Self::kill_inner(&mut process, &self.id, &self.store).await;
                        info!("[{}] job killed and stopped", self.id);
                    }
                    None => warn!(
                        "[{}] a job has no subprocess but having a PAUSING state",
                        self.id
                    ),
                }

                *state = TranscodeJobState::Stopped;
            }
            _ => {
                debug!("[{}] attempting to kill a stopped or finished job", self.id);
            }
        };
    }

    /// An internal function that kills a job and removes it from store
    async fn kill_inner(
        process: &mut Child,
        id: &uuid::Uuid,
        store: &Weak<Mutex<HashMap<uuid::Uuid, TranscodeJob>>>,
    ) {
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

        match store.upgrade() {
            Some(store) => {
                store.lock().await.remove(&id);
            }
            None => {
                warn!("[{}] transcode store had been dropped", id);
            }
        };
    }

    /// Starts capture log from stdout of subprocess.
    fn start_capture(&mut self) {
        let id = self.id.clone();
        let app_handle = self.app_handle.clone();
        let store = Weak::clone(&self.store);
        let process = Arc::clone(&self.process);
        let state = Arc::clone(&self.state);
        let next_state = Arc::clone(&self.next_state);

        tokio::spawn(async move {
            let mut process = process.lock().await;
            let process = match process.as_mut() {
                Some(process) => process,
                None => {
                    error!("[{}] subprocess not found, interrupt job", id);
                    return;
                }
            };

            let stdout = match process.stdout.as_mut() {
                Some(stdout) => stdout,
                None => {
                    Self::kill_inner(process, &id, &store).await;
                    error!("[{}] `stdout` not found, interrupt job", id);
                    return;
                }
            };

            info!("[{}] start subprocess output capturing", id);

            let mut line = String::new();
            let mut reader = BufReader::new(stdout);
            let mut message = TranscodingMessage::new(&id);
            loop {
                // check next state
                let mut next_state = next_state.lock().await;
                if let Some(next_state) = next_state.take() {
                    *state.lock().await = next_state;

                    // stop capture if next state is not running
                    if next_state != TranscodeJobState::Running {
                        break;
                    }
                }

                // read from stdout
                let len = match reader.read_line(&mut line).await {
                    Ok(len) => len,
                    Err(err) => {
                        *state.lock().await = TranscodeJobState::Errored;
                        error!(
                            "[{}] error occurred while reading subprocess output {}",
                            id, err
                        );
                        break;
                    }
                };

                // skip if read nothing
                if len == 0 {
                    continue;
                }

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

                            if send {
                                if let Err(err) =
                                    app_handle.emit_all(TRANSCODING_MESSAGE_EVENT, &message)
                                {
                                    error!(
                                        "[{}] error occurred while emit event to frontend: {}",
                                        id, err
                                    );
                                } else {
                                    trace!("[{}] send message to frontend", id)
                                }

                                message.clear();
                            }
                        }
                        _ => {}
                    }
                };

                line.clear();
            }

            info!("[{}] stop subprocess output capturing", id);

            let state = state.lock().await;
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
                        if let Err(err) = process
                            .stdin
                            .as_mut()
                            .unwrap() // safely unwrap
                            .write_all(&[0xd])
                            .await
                        {
                            Self::kill_inner(process, &id, &store).await;
                            error!(
                                "[{}] error occurred while writing to stdin: {}, interrupt job",
                                id, err
                            );
                        };
                    }

                    #[cfg(not(windows))]
                    {}

                    info!("[{}] job paused", id);
                }
                TranscodeJobState::Stopped => {
                    Self::kill_inner(process, &id, &store).await;
                    info!("[{}] job killed and stopped", id);
                }
                TranscodeJobState::Finished => {
                    info!("[{}] job finished", id);
                }
                TranscodeJobState::Errored => {
                    Self::kill_inner(process, &id, &store).await;
                    info!("[{}] job errored and stopped", id);
                }
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

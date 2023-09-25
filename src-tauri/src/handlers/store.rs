use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Weak,
    }, time::Duration,
};

use log::debug;
use tauri::Manager;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Child,
    sync::Mutex,
    task::JoinHandle,
};

fn start_capture(
    id: uuid::Uuid,
    store: Weak<Mutex<HashMap<uuid::Uuid, Transcoding>>>,
    transcoding: &mut Transcoding,
) {
    let process = transcoding.process.clone();
    let app_handle = transcoding.app_handle.clone();
    let should_stop = transcoding.should_stop.clone();
    let should_pause = transcoding.should_pause.clone();

    let join_handler = tokio::spawn(async move {
        debug!("Start capturing ffmpeg output: {}", id);

        let mut process = process.lock().await;

        let id_string = id.to_string();
        let stdout = process.stdout.as_mut().unwrap();
        let mut line = String::new();
        let mut data = TranscodingProgress::new();
        let mut reader = BufReader::new(stdout);
        let mut is_paused = false;
        loop {
            // stop if should_stop marked to true
            if should_stop.load(Ordering::Acquire) {
                is_paused = false;
                break;
            }

            // pause if should_pause marked to true
            if should_pause.load(Ordering::Acquire) {
                is_paused = true;
                break;
            }

            // send message if progress not empty
            if let Some(progress) = &data.progress {
                let msg = TranscodingMessage {
                    id: &id_string,
                    data: &data,
                };
                app_handle
                    .emit_all(TRANSCODING_MESSAGE_EVENT, &msg)
                    .unwrap();

                if progress == "end" {
                    debug!("Finished transcoding: {}", id);
                    break;
                } else {
                    data.clear();
                }
            }

            let Ok(len) = reader.read_line(&mut line).await else {
                break;
            };

            if len == 0 {
                break;
            }

            // record raw message
            data.raw.push(line.trim().to_string());
            // extract key value
            let mut splitted = line.split("=");
            if let (Some(key), Some(value)) = (splitted.next(), splitted.next()) {
                let key = key.trim();
                let value = value.trim();
                match key {
                    "frame" => {
                        data.frame = value.parse::<usize>().ok();
                    }
                    "fps" => {
                        data.fps = value.parse::<f64>().ok();
                    }
                    "bitrate" => {
                        if value == "N/A" {
                            data.bitrate = None
                        } else {
                            data.bitrate = value[..value.len() - 7].parse::<f64>().ok();
                        }
                    }
                    "total_size" => {
                        data.total_size = value.parse::<usize>().ok();
                    }
                    "out_time_ms" => {
                        data.output_time_ms = value.parse::<usize>().ok();
                    }
                    "dup_frames" => {
                        data.dup_frames = value.parse::<usize>().ok();
                    }
                    "drop_frames" => {
                        data.drop_frames = value.parse::<usize>().ok();
                    }
                    "speed" => {
                        if value == "N/A" {
                            data.speed = None
                        } else {
                            data.speed = value[..value.len() - 1].parse::<f64>().ok();
                        }
                    }
                    "progress" => {
                        data.progress = Some(value.to_string());
                    }
                    _ => {}
                }
            };

            line.clear();
        }

        if is_paused {
            // okay, for windows, pausing the ffmpeg process,
            // it is only have to write a '\r'(Carriage Return, `0xd` in ASCII table)
            // character to ffmpeg subprocess via stdin.
            // And for resuming, write a '\n'(Line Feed, `0xa` in ASCII table) character
            // to ffmpeg subprocess via stdin could simply make it work.
            #[cfg(windows)]
            {
                process.stdin.as_mut().unwrap().write_all(&[0xd]).await.unwrap();
            }

            #[cfg(not(windows))]
            {}
        } else {
            // kill child process and remove it from store
            process.start_kill().unwrap();
            process.wait().await.unwrap();
            if let Some(store) = store.upgrade() {
                store.lock().await.remove(&id);
            }
        }

        debug!("Stop capturing ffmpeg output: {}", id);
    });

    transcoding.join_handler = Some(join_handler);
}

pub struct TranscodingStore {
    store: Arc<Mutex<HashMap<uuid::Uuid, Transcoding>>>,
}

impl TranscodingStore {
    pub fn new() -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn add(&self, id: uuid::Uuid, mut transcoding: Transcoding) {
        start_capture(id, Arc::downgrade(&self.store), &mut transcoding);

        self.store.lock().await.insert(id, transcoding);
    }

    pub async fn stop(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(transcoding) = store.remove(id) else {
            return;
        };
        // drop store immediately,
        // or the capturing thread may deadlocking when trying to remove item from store
        drop(store);

        transcoding.should_stop.store(true, Ordering::Release);
        if let Some(join_handler) = transcoding.join_handler {
            join_handler.await.unwrap();
        }
    }

    pub async fn pause(&self, id: &uuid::Uuid) {
        let mut store = self.store.lock().await;
        let Some(transcoding) = store.get_mut(id) else {
            return;
        };

        transcoding.should_pause.store(true, Ordering::Release);
    }
}

pub struct Transcoding {
    process: Arc<Mutex<Child>>,
    app_handle: tauri::AppHandle,
    join_handler: Option<JoinHandle<()>>,
    should_stop: Arc<AtomicBool>,
    should_pause: Arc<AtomicBool>,
}

static TRANSCODING_MESSAGE_EVENT: &'static str = "transcoding";

#[derive(Debug, Clone, serde::Serialize)]
pub struct TranscodingMessage<'a> {
    id: &'a str,
    data: &'a TranscodingProgress,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TranscodingProgress {
    progress: Option<String>,
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

impl TranscodingProgress {
    pub fn new() -> Self {
        Self {
            progress: None,
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
        self.progress = None;
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

impl Transcoding {
    pub fn new(process: Child, app_handle: tauri::AppHandle) -> Self {
        Self {
            process: Arc::new(Mutex::new(process)),
            app_handle,
            join_handler: None,
            should_stop: Arc::new(AtomicBool::new(false)),
            should_pause: Arc::new(AtomicBool::new(false)),
        }
    }
}

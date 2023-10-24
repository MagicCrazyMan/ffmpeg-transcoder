pub static TASK_MESSAGE_EVENT: &'static str = "transcoding";

#[derive(Debug, Clone, serde::Serialize)]
pub struct TaskRunningMessage {
    pub id: String,
    pub total_duration: f64,
    pub raw: Vec<String>,
    pub frame: Option<usize>,
    pub fps: Option<f64>,
    pub bitrate: Option<f64>,
    pub total_size: Option<usize>,
    pub output_time_ms: Option<usize>,
    pub dup_frames: Option<usize>,
    pub drop_frames: Option<usize>,
    pub speed: Option<f64>,
}

impl TaskRunningMessage {
    pub fn new(id: String, total_duration: f64) -> Self {
        Self {
            id,
            total_duration,
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

/// Task message informing task situation.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "state")]
pub enum TaskMessage<'a> {
    Running(&'a TaskRunningMessage),
    Finished { id: String },
    Errored { id: String, reason: String },
}

impl<'a> TaskMessage<'a> {
    pub fn running(msg: &'a TaskRunningMessage) -> Self {
        Self::Running(msg)
    }

    pub fn finished(id: String) -> Self {
        Self::Finished { id }
    }

    pub fn errored(id: String, reason: String) -> Self {
        Self::Errored { id, reason }
    }
}

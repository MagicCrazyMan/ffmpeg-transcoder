pub static TASK_MESSAGE_EVENT: &'static str = "transcoding";

#[derive(Debug, Clone, serde::Serialize)]
pub(super) struct TaskRunningMessage {
    pub(super) id: String,
    pub(super) raw: Vec<String>,
    pub(super) frame: Option<usize>,
    pub(super) fps: Option<f64>,
    pub(super) bitrate: Option<f64>,
    pub(super) total_size: Option<usize>,
    pub(super) output_time_ms: Option<usize>,
    pub(super) dup_frames: Option<usize>,
    pub(super) drop_frames: Option<usize>,
    pub(super) speed: Option<f64>,
}

impl TaskRunningMessage {
    pub(super) fn new(id: String) -> Self {
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

    pub(super) fn clear(&mut self) {
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
#[serde(tag = "type")]
pub(super) enum TaskMessage<'a> {
    Idle { id: String },
    Running(&'a TaskRunningMessage),
    Paused { id: String },
    Stopped { id: String },
    Finished { id: String },
    Errored { id: String, reason: String },
}

impl<'a> TaskMessage<'a> {
    pub(super) fn idle(id: String) -> Self {
        Self::Idle { id }
    }

    pub(super) fn running(msg: &'a TaskRunningMessage) -> Self {
        Self::Running(msg)
    }

    pub(super) fn pausing(id: String) -> Self {
        Self::Paused { id }
    }

    pub(super) fn stopped(id: String) -> Self {
        Self::Stopped { id }
    }

    pub(super) fn finished(id: String) -> Self {
        Self::Finished { id }
    }

    pub(super) fn errored(id: String, reason: String) -> Self {
        Self::Errored { id, reason }
    }
}

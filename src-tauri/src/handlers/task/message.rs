pub static TASK_MESSAGE_EVENT: &'static str = "transcoding";

#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct TaskRunningMessage {
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
    pub(crate) fn new(id: String) -> Self {
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

    pub(crate) fn clear(&mut self) {
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
pub(crate) enum TaskMessage<'a> {
    Running(&'a TaskRunningMessage),
    Paused { id: String },
    Stopped { id: String },
    Finished { id: String },
    Errored { id: String, reason: String },
}

impl<'a> TaskMessage<'a> {
    pub(crate) fn running(msg: &'a TaskRunningMessage) -> Self {
        Self::Running(msg)
    }

    pub(crate) fn paused(id: String) -> Self {
        Self::Paused { id }
    }

    pub(crate) fn stopped(id: String) -> Self {
        Self::Stopped { id }
    }

    pub(crate) fn finished(id: String) -> Self {
        Self::Finished { id }
    }

    pub(crate) fn errored(id: String, reason: String) -> Self {
        Self::Errored { id, reason }
    }
}

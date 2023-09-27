use std::process::Stdio;

use async_trait::async_trait;
use log::{info, warn};
use tokio::{
    io::AsyncWriteExt,
    process::{Child, Command},
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;

use crate::handlers::error::Error;

use super::item::TaskData;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TaskStateCode {
    Idle,
    Running,
    Pausing,
    Stopped,
    Finished,
    Errored,
}

#[async_trait]
pub(crate) trait TaskStateMachineNode: Send {
    fn state_code(&self) -> TaskStateCode;

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode>;

    async fn pause(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode>;

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode>;

    async fn stop(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode>;
}

pub(crate) struct Idle;

#[async_trait]
impl TaskStateMachineNode for Idle {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Idle
    }

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        let process = Command::new(data.program())
            .args(data.args())
            .stdin(Stdio::piped())
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|err| match err.kind() {
                std::io::ErrorKind::NotFound => Error::ffmpeg_not_found(data.program()),
                _ => Error::ffmpeg_unavailable(data.program(), err),
            });
        let process = match process {
            Ok(process) => process,
            Err(err) => {
                return Box::new(Errored::from_err(err));
            }
        };

        let watchdog_cancellation = CancellationToken::new();
        let watchdog_handle = data.start_watchdog(&watchdog_cancellation);

        let next_state = Box::new(Running {
            process,
            watchdog_cancellation,
            watchdog_handle,
        });

        info!(
            "[{}] start task with command: {} {}",
            data.id(),
            data.program(),
            data.args()
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

    async fn pause(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a not start task", data.id());
        self
    }

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a not start task", data.id());
        self
    }

    async fn stop(self: Box<Self>, _data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        Box::new(Stopped)
    }
}

pub(crate) struct Running {
    process: Child,
    watchdog_cancellation: CancellationToken,
    watchdog_handle: JoinHandle<()>,
}

#[async_trait]
impl TaskStateMachineNode for Running {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Running
    }

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a running task", data.id());
        self
    }

    async fn pause(self: Box<Self>, _data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        let mut process = self.process;

        #[cfg(windows)]
        {
            if let Err(err) = process.stdin.as_mut().unwrap().write_all(&[0xd]).await {
                return Box::new(Errored::from_err(err));
            }
        }

        #[cfg(not(windows))]
        {}

        self.watchdog_cancellation.cancel();

        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Pausing { process })
        }
    }

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a running task", data.id());
        self
    }

    async fn stop(self: Box<Self>, _data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        let mut process = self.process;
        let kill = async {
            process.start_kill()?;
            process.wait().await
        };
        if let Err(err) = kill.await {
            return Box::new(Errored::from_err(err));
        };

        self.watchdog_cancellation.cancel();
        if let Err(err) = self.watchdog_handle.await {
            Box::new(Errored::from_err(err))
        } else {
            Box::new(Stopped)
        }
    }
}

pub(crate) struct Pausing {
    process: Child,
}

#[async_trait]
impl TaskStateMachineNode for Pausing {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Pausing
    }

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a pausing task", data.id());
        self
    }

    async fn pause(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a pausing task", data.id());
        self
    }

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        let mut process = self.process;

        #[cfg(windows)]
        {
            if let Err(err) = process.stdin.as_mut().unwrap().write_all(&[0xa]).await {
                return Box::new(Errored::from_err(err));
            }
        }

        #[cfg(not(windows))]
        {}

        let watchdog_cancellation = CancellationToken::new();
        let watchdog_handle = data.start_watchdog(&watchdog_cancellation);

        Box::new(Running {
            process,
            watchdog_cancellation,
            watchdog_handle,
        })
    }

    async fn stop(self: Box<Self>, _data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        let mut process = self.process;
        let kill = async {
            process.start_kill()?;
            process.wait().await
        };
        if let Err(err) = kill.await {
            return Box::new(Errored::from_err(err));
        };

        Box::new(Stopped)
    }
}

pub(crate) struct Stopped;

#[async_trait]
impl TaskStateMachineNode for Stopped {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Stopped
    }

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a stopped task", data.id());
        self
    }

    async fn pause(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a stopped task", data.id());
        self
    }

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a stopped task", data.id());
        self
    }

    async fn stop(self: Box<Self>, _data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        self
    }
}

pub(crate) struct Errored {
    reason: String,
}

impl Errored {
    fn from_err<E: std::error::Error>(reason: E) -> Self {
        Self {
            reason: reason.to_string(),
        }
    }
}

#[async_trait]
impl TaskStateMachineNode for Errored {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Errored
    }

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a errored task", data.id());
        self
    }

    async fn pause(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a errored task", data.id());
        self
    }

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a errored task", data.id());
        self
    }

    async fn stop(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to stop a errored task", data.id());
        self
    }
}

pub(crate) struct Finished;

#[async_trait]
impl TaskStateMachineNode for Finished {
    fn state_code(&self) -> TaskStateCode {
        TaskStateCode::Finished
    }

    async fn start(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to start a finished task", data.id());
        self
    }

    async fn pause(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to pause a finished task", data.id());
        self
    }

    async fn resume(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to resume a finished task", data.id());
        self
    }

    async fn stop(self: Box<Self>, data: &TaskData) -> Box<dyn TaskStateMachineNode> {
        warn!("[{}] attempting to stop a finished task", data.id());
        self
    }
}

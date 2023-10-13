use std::sync::Arc;

use log::LevelFilter;
use tokio::sync::Mutex;

pub type AppConfig = Arc<Mutex<Option<Config>>>;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct Config {
    loglevel: LevelFilter,
    ffmpeg: String,
    ffprobe: String,
}

impl Config {
    /// Gets log level
    pub fn loglevel(&self) -> LevelFilter {
        self.loglevel
    }

    /// Gets ffmpeg command.
    pub fn ffmpeg(&self) -> &str {
        &self.ffmpeg
    }

    /// Gets ffprobe command.
    pub fn ffprobe(&self) -> &str {
        &self.ffprobe
    }
}
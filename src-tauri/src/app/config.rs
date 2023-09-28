use std::{env::current_dir, fs};

use log::info;

use crate::app::result::IntoAppResult;

use super::result::AppResult;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Config {
    #[serde(default = "Binary::default")]
    binary: Binary,
}

impl Config {
    /// Read configs from local file named `Config.toml` next to executable file.
    pub fn from_file_or_default() -> AppResult<Config> {
        static CONFIG_FILENAME: &'static str = "Config.toml";

        let config_path = current_dir().into_app_result()?.join(CONFIG_FILENAME);
        let config = if config_path.is_file() {
            info!("read config from file {}", config_path.to_string_lossy());

            let config_str = fs::read_to_string(config_path).into_app_result()?;
            toml::from_str(&config_str).into_app_result()?
        } else {
            info!("config file not found, using default configs");

            let config = Config::default();

            config
        };

        Ok(config)
    }

    /// Gets default configs.
    pub fn default() -> Self {
        Self {
            binary: Binary::default(),
        }
    }

    /// Gets [`Binary`] configs.
    pub fn binary(&self) -> &Binary {
        &self.binary
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Binary {
    #[serde(default = "Binary::default_ffmpeg")]
    ffmpeg: String,
    #[serde(default = "Binary::default_ffprobe")]
    ffprob: String,
}

impl Binary {
    /// Gets default ffmpeg binary location, equals `ffmpeg`.
    pub fn default_ffmpeg() -> String {
        "ffmpeg".to_string()
    }

    /// Gets default ffprob binary location, equals `ffprob`.
    pub fn default_ffprobe() -> String {
        "ffprobe".to_string()
    }

    /// Gets default binary configs.
    pub fn default() -> Self {
        Self {
            ffmpeg: Self::default_ffmpeg(),
            ffprob: Self::default_ffprobe(),
        }
    }

    /// Gets ffmpeg command.
    pub fn ffmpeg(&self) -> &str {
        &self.ffmpeg
    }

    /// Gets ffprobe command.
    pub fn ffprobe(&self) -> &str {
        &self.ffprob
    }
}

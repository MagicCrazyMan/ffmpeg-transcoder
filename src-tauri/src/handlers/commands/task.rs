use serde_json::{Map, Value};

use crate::{
    handlers::{config::AppConfig, error::Error, task::store::TaskStore},
    with_default_args,
};

use super::process::invoke_ffprobe;

/// A structure receiving ffmpeg command line arguments.
#[derive(Debug, serde::Deserialize)]
pub struct TaskParams {
    pub inputs: Vec<TaskInputParams>,
    pub outputs: Vec<TaskOutputParams>,
}

impl TaskParams {
    /// Converts to ffmpeg command line arguments.
    pub fn to_args(&self) -> Vec<String> {
        let prepend_args = with_default_args!("-progress", "-", "-nostats")
            .iter()
            .map(|str| *str);
        let input_args = self.inputs.iter().flat_map(|input| {
            input
                .params
                .iter()
                .map(|param| param.as_str())
                .chain(["-i", input.path.as_str()])
        });
        let output_args = self.outputs.iter().flat_map(|output| {
            output
                .params
                .iter()
                .map(|param| param.as_str())
                .chain(match &output.path {
                    Some(path) => [path.as_ref(), "", ""],
                    None => ["-f", "null", "-"],
                })
        });
        let append_args = [("-y")];
        let args = prepend_args
            .chain(input_args)
            .chain(output_args)
            .chain(append_args)
            .filter(|arg| !arg.is_empty())
            .map(|arg| arg.to_string())
            .collect::<Vec<_>>();

        args
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct TaskInputParams {
    pub path: String,
    #[serde(default = "Vec::new")]
    pub params: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct TaskOutputParams {
    /// Output path could be None in some situation,
    /// such as exports to null.
    pub path: Option<String>,
    #[serde(default = "Vec::new")]
    pub params: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct TaskId {
    id: String,
}

/// A command starts a new task.
#[tauri::command]
pub async fn start_task(
    app_handle: tauri::AppHandle,
    config: tauri::State<'_, AppConfig>,
    task_store: tauri::State<'_, TaskStore>,
    id: String,
    params: TaskParams,
) -> Result<(), Error> {
    let config = config.lock().await;
    let Some(config) = config.as_ref() else {
        return Err(Error::configuration_not_loaded());
    };

    // find maximum duration from all inputs
    let mut total_duration = 0.0;
    for input in params.inputs.iter() {
        let raw = media_metadata_inner(config.ffprobe(), &input.path).await?;
        let obj: Map<String, Value> = match serde_json::from_str(&raw) {
            Ok(obj) => obj,
            Err(_) => continue,
        };

        // extract duration from format
        if let Some(Value::Object(format)) = obj.get("format") {
            if let Some(Value::String(duration)) = format.get("duration") {
                if let Ok(duration) = duration.parse::<f64>() {
                    if duration > total_duration {
                        total_duration = duration;
                    }
                }
            }
        }

        // extract duration from streams
        let Some(Value::Array(streams)) = obj.get("streams") else {
            continue;
        };
        for stream in streams {
            let Value::Object(stream) = stream else {
                continue;
            };

            let Some(Value::String(duration)) = stream.get("duration") else {
                continue;
            };

            let Ok(duration) = duration.parse::<f64>() else {
                continue;
            };

            if duration > total_duration {
                total_duration = duration;
            }
        }
    }

    task_store
        .start(
            id,
            params,
            app_handle,
            total_duration,
            config.ffmpeg().to_string(),
        )
        .await;

    Ok(())
}

/// A command stops a new task.
#[tauri::command]
pub async fn stop_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    task_store.stop(&id).await;
    Ok(())
}

/// A command pauses a new task.
#[tauri::command]
pub async fn pause_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    task_store.pause(&id).await;
    Ok(())
}

/// A command resumes a new task.
#[tauri::command]
pub async fn resume_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    task_store.resume(&id).await;
    Ok(())
}

async fn media_metadata_inner(ffprobe: &str, path: &str) -> Result<String, Error> {
    let output = invoke_ffprobe(
        ffprobe,
        with_default_args! {
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            "-show_chapters",
            &path
        },
    )
    .await?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// A command returns media properties using ffprobe.
///
/// Preventing unnecessary conversion between json object and plain text,
/// this command return plain json text from stdout directly without serializing to json object.
#[tauri::command]
pub async fn media_metadata(
    config: tauri::State<'_, AppConfig>,
    path: String,
) -> Result<String, Error> {
    let config = config.lock().await;
    let Some(config) = config.as_ref() else {
        return Err(Error::configuration_not_loaded());
    };

    let metadata = media_metadata_inner(config.ffprobe(), &path).await?;
    Ok(metadata)
}

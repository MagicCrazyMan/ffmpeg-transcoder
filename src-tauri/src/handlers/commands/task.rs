use std::str::FromStr;

use serde_json::{Map, Value};

use crate::{
    app::config::Config,
    handlers::{error::Error, task::store::TaskStore},
    with_default_args,
};

use super::process::invoke_ffprobe;

/// A structure receiving ffmpeg command line arguments.
#[derive(Debug, serde::Deserialize)]
pub struct TaskParams {
    inputs: Vec<TaskInputParams>,
    outputs: Vec<TaskOutputParams>,
}

impl TaskParams {
    /// Converts to ffmpeg command line arguments.
    fn to_args(&self) -> Vec<String> {
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
                .chain([output.path.as_ref().map(|path| path.as_str()).unwrap_or("")])
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
    path: String,
    #[serde(default = "Vec::new")]
    params: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct TaskOutputParams {
    /// Output path could be None in some situation,
    /// such as exports to null.
    path: Option<String>,
    #[serde(default = "Vec::new")]
    params: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct TaskId {
    id: String,
}

/// A command starts a new task.
#[tauri::command]
pub async fn start_task(
    app_handle: tauri::AppHandle,
    config: tauri::State<'_, Config>,
    task_store: tauri::State<'_, TaskStore>,
    id: String,
    params: TaskParams,
) -> Result<(), Error> {
    // find maximum duration from all inputs
    let mut total_duration = 0.0;
    for input in params.inputs.iter() {
        let raw = media_metadata_inner(config.binary().ffprobe(), &input.path).await?;
        let obj: Map<String, Value> = match serde_json::from_str(&raw) {
            Ok(obj) => obj,
            Err(_) => continue,
        };

        let streams = match obj.get("streams").unwrap_or(&Value::Null) {
            Value::Array(streams) => streams,
            _ => continue,
        };

        for stream in streams {
            let stream = match stream {
                Value::Object(stream) => stream,
                _ => continue,
            };

            let duration = match stream.get("duration").unwrap_or(&Value::Null) {
                Value::String(duration) => duration,
                _ => continue,
            };

            let duration = match duration.parse::<f64>() {
                Ok(duration) => duration,
                Err(_) => continue,
            };

            if duration > total_duration {
                total_duration = duration;
            }
        }
    }

    let id = id.try_into_uuid()?;
    let args = params.to_args();
    task_store
        .start(
            id,
            args,
            app_handle,
            total_duration,
            config.binary().ffmpeg().to_string(),
        )
        .await;

    Ok(())
}

/// A command stops a new task.
#[tauri::command]
pub async fn stop_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    let id = id.try_into_uuid()?;
    task_store.stop(&id).await;
    Ok(())
}

/// A command pauses a new task.
#[tauri::command]
pub async fn pause_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    let id = id.try_into_uuid()?;
    task_store.pause(&id).await;
    Ok(())
}

/// A command resumes a new task.
#[tauri::command]
pub async fn resume_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    let id = id.try_into_uuid()?;
    task_store.resume(&id).await;
    Ok(())
}

trait TryIntoUuid {
    fn try_into_uuid(self) -> Result<uuid::Uuid, Error>;
}

impl<S> TryIntoUuid for S
where
    S: Into<String> + 'static,
{
    fn try_into_uuid(self) -> Result<uuid::Uuid, Error> {
        let raw = self.into();
        match uuid::Uuid::from_str(&raw) {
            Ok(uuid) => Ok(uuid),
            Err(_) => Err(Error::task_id_unavailable(raw)),
        }
    }
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
    config: tauri::State<'_, Config>,
    path: String,
) -> Result<String, Error> {
    let metadata = media_metadata_inner(config.binary().ffprobe(), &path).await?;
    Ok(metadata)
}

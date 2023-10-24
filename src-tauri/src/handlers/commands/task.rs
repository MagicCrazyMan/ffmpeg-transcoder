use crate::{
    handlers::{config::AppConfig, error::Error, tasks::store::TaskStore},
    with_default_args,
};

use super::process::invoke_ffprobe_json_metadata;

/// A structure receiving ffmpeg command line arguments.
#[derive(Debug, serde::Deserialize)]
pub struct TaskArgs {
    pub inputs: Vec<TaskInputArgs>,
    pub outputs: Vec<TaskOutputArgs>,
}

impl TaskArgs {
    /// Converts to ffmpeg command line arguments.
    pub fn to_cli_args(&self) -> Vec<String> {
        let prepend_args = with_default_args!("-progress", "-", "-nostats")
            .iter()
            .map(|str| *str);
        let input_args = self.inputs.iter().flat_map(|input| {
            input
                .args
                .iter()
                .map(|param| param.as_str())
                .chain(["-i", input.path.as_str()])
        });
        let output_args = self.outputs.iter().flat_map(|output| {
            output
                .args
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
pub struct TaskInputArgs {
    pub path: String,
    #[serde(default = "Vec::new")]
    pub args: Vec<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct TaskOutputArgs {
    /// Output path could be None in some situation,
    /// such as exports to null.
    pub path: Option<String>,
    #[serde(default = "Vec::new")]
    pub args: Vec<String>,
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
    args: TaskArgs,
) -> Result<(), Error> {
    let config = config.lock().await;
    let Some(config) = config.as_ref() else {
        return Err(Error::configuration_not_loaded());
    };

    task_store
        .start(
            id,
            args,
            app_handle,
            config.ffmpeg().to_string(),
            config.ffprobe().to_string(),
        )
        .await?;

    Ok(())
}

/// A command stops a new task.
#[tauri::command]
pub async fn stop_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    task_store.stop(&id).await?;
    Ok(())
}

/// A command pauses a new task.
#[tauri::command]
pub async fn pause_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    task_store.pause(&id).await?;
    Ok(())
}

/// A command resumes a new task.
#[tauri::command]
pub async fn resume_task(task_store: tauri::State<'_, TaskStore>, id: String) -> Result<(), Error> {
    task_store.resume(&id).await?;
    Ok(())
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

    let metadata = invoke_ffprobe_json_metadata(config.ffprobe(), &path).await?;
    Ok(metadata)
}

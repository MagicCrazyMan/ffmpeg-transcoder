use std::{
    collections::VecDeque,
    path::{Path, PathBuf, MAIN_SEPARATOR},
};

use tokio::fs;

use crate::handlers::error::{Error, ErrorKind};

#[derive(Debug, serde::Serialize)]
pub struct TargetFile {
    filename: String,
    /// File extension, parse to lowercase if existed
    extension: Option<String>,
    absolute: String,
    relative: String,
}

impl TargetFile {
    fn from_path(value: &Path, relative_prefix_len: usize) -> Result<Self, ()> {
        let (Some(filename), extension, Ok(absolute)) = (
            value.file_name().map(|s| s.to_string_lossy().to_string()),
            value
                .extension()
                .map(|s| s.to_string_lossy().to_lowercase().to_string()),
            value
                .canonicalize()
                .map(|s| s.to_string_lossy().to_string()),
        ) else {
            return Err(());
        };

        let relative = absolute[relative_prefix_len..].to_string();

        Ok(Self {
            filename,
            extension,
            absolute,
            relative,
        })
    }
}

/// A command finds all files(in relative path) from a directory recursively,
/// a flatten files list will be returned.
#[tauri::command]
pub async fn files_from_directory(dir: String) -> Result<Vec<TargetFile>, Error> {
    let path = PathBuf::from(&dir);
    let canonicalized_path = path.canonicalize().map(|p| p.to_string_lossy().to_string());
    if !path.is_dir() || canonicalized_path.is_err() {
        return Err(Error::new_with_keywords(
            ErrorKind::DirectoryNotFound,
            vec![dir],
        ));
    }

    let canonicalized_path = format!("{}{}", canonicalized_path.unwrap(), MAIN_SEPARATOR);
    let mut directories = VecDeque::from([path]);
    let mut files = Vec::with_capacity(128);
    while let Some(dir) = directories.pop_front() {
        let Ok(mut entries) = fs::read_dir(dir).await else {
            continue;
        };

        while let Some(entry) = entries.next_entry().await.ok().and_then(|e| e) {
            let entry = entry.path();

            if entry.is_dir() {
                directories.push_back(entry);
            } else if entry.is_file() {
                if let Ok(file) = TargetFile::from_path(&entry, canonicalized_path.as_bytes().len())
                {
                    files.push(file);
                }
            }
        }
    }

    Ok(files)
}

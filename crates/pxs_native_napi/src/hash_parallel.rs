// Băm SHA-256 hàng loạt tệp tin 64-bit đa luồng bằng Rayon + N-API AsyncTask (không cần worker_threads).

use std::collections::HashMap;
use std::fs;

use napi::bindgen_prelude::{AsyncTask, Env, Error, Result, Status, Task};
use napi_derive::napi;
use pxs_core_accel::sha256_hex;
use rayon::prelude::*;

pub fn hash_files_rayon_core(paths: &[String]) -> std::result::Result<HashMap<String, String>, String> {
    if paths.is_empty() {
        return Ok(HashMap::new());
    }
    if paths.len() == 1 {
        let p = &paths[0];
        let bytes = fs::read(p).map_err(|e| format!("Không thể đọc tệp '{p}': {e}"))?;
        let mut map = HashMap::with_capacity(1);
        map.insert(p.clone(), sha256_hex(&bytes));
        return Ok(map);
    }

    let pairs: std::result::Result<Vec<(String, String)>, String> = paths
        .par_iter()
        .map(|p| {
            let bytes = fs::read(p).map_err(|e| format!("Không thể đọc tệp '{p}': {e}"))?;
            Ok((p.clone(), sha256_hex(&bytes)))
        })
        .collect();

    Ok(pairs?.into_iter().collect())
}

pub struct HashFilesTask {
    pub paths: Vec<String>,
}

#[napi]
impl Task for HashFilesTask {
    type Output = HashMap<String, String>;
    type JsValue = HashMap<String, String>;

    fn compute(&mut self) -> Result<Self::Output> {
        hash_files_rayon_core(&self.paths).map_err(|msg| Error::new(Status::GenericFailure, msg))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi]
pub fn napi_hash_files_sync(paths: Vec<String>) -> Result<HashMap<String, String>> {
    hash_files_rayon_core(&paths).map_err(|msg| Error::new(Status::GenericFailure, msg))
}

#[napi]
pub fn napi_hash_files_parallel(paths: Vec<String>) -> AsyncTask<HashFilesTask> {
    AsyncTask::new(HashFilesTask { paths })
}

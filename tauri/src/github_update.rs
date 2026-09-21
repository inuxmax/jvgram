use std::io::Write;
use std::time::Duration;

use serde::Serialize;
use tauri::Emitter;
use url::Url;

const PROGRESS_EVENT: &str = "github-update-progress";

const GITHUB_LATEST_RELEASE: &str = "https://github.com/inuxmax/jvgram/releases/latest";
const GITHUB_DOWNLOAD_PREFIX: &str = "https://github.com/inuxmax/jvgram/releases/download";
const USER_AGENT: &str = concat!("JVgram/", env!("CARGO_PKG_VERSION"));
const CHECK_TIMEOUT_SECS: u64 = 20;
const DOWNLOAD_TIMEOUT_SECS: u64 = 600;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubUpdate {
  version: String,
  notes: Option<String>,
  download_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GithubUpdateProgress {
  percent: u8,
  downloaded: u64,
  total: Option<u64>,
}

pub async fn check() -> Result<Option<GithubUpdate>, String> {
  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .timeout(Duration::from_secs(CHECK_TIMEOUT_SECS))
    .build()
    .map_err(|err| err.to_string())?;

  let response = client
    .get(GITHUB_LATEST_RELEASE)
    .send()
    .await
    .map_err(|err| err.to_string())?;

  if !response.status().is_success() {
    return Err(format!("GitHub releases returned {}", response.status()));
  }

  let final_url = response.url().clone();
  let tag = match tag_from_release_url(&final_url) {
    Some(tag) => tag,
    None => {
      let html = response.text().await.map_err(|err| err.to_string())?;
      tag_from_release_html(&html)
        .ok_or_else(|| format!("Could not read latest tag from {final_url}"))?
    }
  };
  let version = normalize_version(&tag);
  if !is_remote_newer(&version, env!("CARGO_PKG_VERSION")) {
    return Ok(None);
  }

  Ok(Some(GithubUpdate {
    version: version.clone(),
    notes: None,
    download_url: format!("{GITHUB_DOWNLOAD_PREFIX}/{tag}/JVgram_{version}_x64-setup.exe"),
  }))
}

pub async fn install(app: tauri::AppHandle, download_url: String) -> Result<(), String> {
  let parsed = Url::parse(&download_url).map_err(|err| err.to_string())?;
  if !is_github_asset_url(&parsed) {
    return Err("Update URL is not a GitHub release asset".to_string());
  }

  let file_name = parsed
    .path_segments()
    .and_then(|segments| segments.last())
    .filter(|name| name.to_ascii_lowercase().ends_with(".exe"))
    .unwrap_or("JVgram-setup.exe")
    .to_string();

  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
    .build()
    .map_err(|err| err.to_string())?;

  let response = client
    .get(parsed.as_str())
    .send()
    .await
    .map_err(|err| err.to_string())?;

  if !response.status().is_success() {
    return Err(format!("Download failed with {}", response.status()));
  }

  let total = response.content_length();
  let installer_path = std::env::temp_dir().join(file_name);
  let mut file = std::fs::File::create(&installer_path).map_err(|err| err.to_string())?;
  let mut downloaded: u64 = 0;
  let mut last_percent: u8 = 0;
  let mut response = response;

  emit_progress(&app, 0, 0, total);

  loop {
    let chunk = response.chunk().await.map_err(|err| err.to_string())?;
    let Some(chunk) = chunk else { break };

    file.write_all(&chunk).map_err(|err| err.to_string())?;
    downloaded = downloaded.saturating_add(chunk.len() as u64);

    let percent = match total {
      Some(total) if total > 0 => ((downloaded.saturating_mul(100)) / total).min(100) as u8,
      _ => 0,
    };

    if percent != last_percent {
      last_percent = percent;
      emit_progress(&app, percent, downloaded, total);
    }
  }

  file.flush().map_err(|err| err.to_string())?;
  emit_progress(&app, 100, downloaded, total);

  spawn_installer(&installer_path)?;
  app.exit(0);
  Ok(())
}

fn emit_progress(app: &tauri::AppHandle, percent: u8, downloaded: u64, total: Option<u64>) {
  let _ = app.emit(
    PROGRESS_EVENT,
    GithubUpdateProgress {
      percent,
      downloaded,
      total,
    },
  );
}

fn spawn_installer(path: &std::path::Path) -> Result<(), String> {
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;

    const DETACHED_PROCESS: u32 = 0x00000008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
    const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;

    std::process::Command::new(path)
      .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB)
      .spawn()
      .map_err(|err| err.to_string())?;
    return Ok(());
  }

  #[cfg(not(windows))]
  {
    let _ = path;
    Err("Automatic install is available on Windows".to_string())
  }
}

fn tag_from_release_url(url: &Url) -> Option<String> {
  let mut parts = url.path_segments()?;
  let _owner = parts.next()?;
  let _repo = parts.next()?;
  if parts.next()? != "releases" {
    return None;
  }
  if parts.next()? != "tag" {
    return None;
  }
  parts.next().map(str::to_string)
}

fn tag_from_release_html(html: &str) -> Option<String> {
  let marker = "/releases/tag/";
  let start = html.find(marker)? + marker.len();
  let rest = html.get(start..)?;
  let end = rest
    .find(|ch: char| !(ch.is_ascii_alphanumeric() || matches!(ch, '_' | '.' | '-')))
    .unwrap_or(rest.len());
  let tag = rest.get(..end)?.trim();
  if tag.is_empty() { None } else { Some(tag.to_string()) }
}

fn is_github_asset_url(url: &Url) -> bool {
  if url.scheme() != "https" {
    return false;
  }

  let Some(host) = url.host_str() else {
    return false;
  };

  host == "github.com"
    || host.ends_with(".github.com")
    || host == "githubusercontent.com"
    || host.ends_with(".githubusercontent.com")
}

fn normalize_version(tag: &str) -> String {
  tag
    .trim()
    .trim_start_matches("air_")
    .trim_start_matches('v')
    .trim_start_matches('V')
    .split(['-', '+'])
    .next()
    .unwrap_or(tag)
    .to_string()
}

fn is_remote_newer(remote: &str, local: &str) -> bool {
  match (parse_semver(remote), parse_semver(local)) {
    (Some(remote_parts), Some(local_parts)) => remote_parts > local_parts,
    _ => remote != local,
  }
}

fn parse_semver(value: &str) -> Option<(u64, u64, u64)> {
  let mut parts = value.split('.');
  let major = parts.next()?.parse().ok()?;
  let minor = parts.next()?.parse().ok()?;
  let patch = parts.next().unwrap_or("0").parse().ok()?;
  Some((major, minor, patch))
}

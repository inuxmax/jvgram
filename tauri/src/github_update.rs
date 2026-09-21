use std::time::Duration;

use serde::{Deserialize, Serialize};
use url::Url;

const GITHUB_RELEASES_LATEST: &str =
  "https://api.github.com/repos/inuxmax/telegram-tt/releases/latest";
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

#[derive(Debug, Deserialize)]
struct GithubRelease {
  tag_name: String,
  body: Option<String>,
  draft: bool,
  prerelease: bool,
  assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
  name: String,
  browser_download_url: String,
}

pub async fn check() -> Result<Option<GithubUpdate>, String> {
  let client = reqwest::Client::builder()
    .user_agent(USER_AGENT)
    .timeout(Duration::from_secs(CHECK_TIMEOUT_SECS))
    .build()
    .map_err(|err| err.to_string())?;

  let response = client
    .get(GITHUB_RELEASES_LATEST)
    .header("Accept", "application/vnd.github+json")
    .header("X-GitHub-Api-Version", "2022-11-28")
    .send()
    .await
    .map_err(|err| err.to_string())?;

  if !response.status().is_success() {
    return Err(format!("GitHub releases returned {}", response.status()));
  }

  let release = response
    .json::<GithubRelease>()
    .await
    .map_err(|err| err.to_string())?;

  if release.draft || release.prerelease {
    return Ok(None);
  }

  let version = normalize_version(&release.tag_name);
  if !is_remote_newer(&version, env!("CARGO_PKG_VERSION")) {
    return Ok(None);
  }

  let Some(download_url) = pick_installer_url(&release.assets) else {
    return Ok(None);
  };

  Ok(Some(GithubUpdate {
    version,
    notes: release.body.filter(|body| !body.trim().is_empty()),
    download_url,
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

  let bytes = response.bytes().await.map_err(|err| err.to_string())?;
  let installer_path = std::env::temp_dir().join(file_name);
  std::fs::write(&installer_path, &bytes).map_err(|err| err.to_string())?;

  spawn_installer(&installer_path)?;
  app.exit(0);
  Ok(())
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

fn pick_installer_url(assets: &[GithubAsset]) -> Option<String> {
  let setup = assets.iter().find(|asset| {
    let name = asset.name.to_ascii_lowercase();
    name.contains("setup") && name.ends_with(".exe")
  });
  let exe = assets.iter().find(|asset| asset.name.to_ascii_lowercase().ends_with(".exe"));

  setup.or(exe).map(|asset| asset.browser_download_url.clone())
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

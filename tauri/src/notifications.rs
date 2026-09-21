use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[cfg_attr(not(windows), allow(dead_code))]
pub const NOTIFICATION_CLICKED_EVENT: &str = "notification-clicked";
pub const DESKTOP_TOAST_WINDOW_LABEL: &str = "desktop-toast";

#[cfg(windows)]
const TOAST_WIDTH: f64 = 360.0;
#[cfg(windows)]
const TOAST_HEIGHT: f64 = 104.0;
#[cfg(windows)]
const TOAST_MARGIN: f64 = 16.0;
#[cfg(windows)]
const WINDOWS_TOAST_TITLE_MAX: usize = 64;
#[cfg(windows)]
const WINDOWS_TOAST_BODY_MAX: usize = 180;
#[cfg(windows)]
const APP_USER_MODEL_ID_KEY: windows::Win32::Foundation::PROPERTYKEY =
  windows::Win32::Foundation::PROPERTYKEY {
    fmtid: windows::core::GUID::from_u128(0x9F4C2855_9F79_4B39_A8D0_E1D42DE1D5F3),
    pid: 5,
  };

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationClickPayload {
  pub chat_id: Option<String>,
  pub message_id: Option<i32>,
  pub is_call: bool,
}

static PENDING_TOAST: std::sync::Mutex<Option<NotificationClickPayload>> = std::sync::Mutex::new(None);

pub fn is_desktop_toast_window(label: &str) -> bool {
  label == DESKTOP_TOAST_WINDOW_LABEL
}

pub fn show_and_focus_any_window(app: &AppHandle) {
  let windows = app.windows();
  let mut main_windows = windows
    .iter()
    .filter(|(label, _)| !is_desktop_toast_window(label));

  let Some((_, window)) = main_windows.next() else {
    let url = if let Ok(last_url) = crate::LAST_URL.lock() {
      last_url.clone()
    } else {
      crate::BASE_URL.to_string()
    };
    if let Err(err) = crate::open_new_window(app.clone(), url) {
      log::error!("Failed to open window from notification: {:?}", err);
    }
    return;
  };

  let _ = window.unminimize();
  let _ = window.show();
  let _ = window.set_focus();
}

pub fn is_app_window_active(app: &AppHandle) -> bool {
  app.windows().iter().any(|(label, window)| {
    !is_desktop_toast_window(label)
      && window.is_visible().unwrap_or(false)
      && !window.is_minimized().unwrap_or(false)
      && window.is_focused().unwrap_or(false)
  })
}

pub fn close_desktop_toast(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(DESKTOP_TOAST_WINDOW_LABEL) {
    let _ = window.close();
  }
}

pub fn activate_desktop_toast(app: &AppHandle) {
  let payload = PENDING_TOAST.lock().ok().and_then(|mut pending| pending.take());
  close_desktop_toast(app);
  show_and_focus_any_window(app);
  if let Some(payload) = payload {
    let _ = app.emit(NOTIFICATION_CLICKED_EVENT, payload);
  }
}

#[cfg(windows)]
pub fn init_windows_notifications(app_id: &str) {
  set_current_aumid(app_id);
  if let Err(err) = register_start_menu_shortcut(app_id) {
    log::warn!("Failed to register Telegram Air toast identity: {err:?}");
  }
}

#[cfg(not(windows))]
pub fn init_windows_notifications(_app_id: &str) {}

#[cfg(windows)]
fn set_current_aumid(app_id: &str) {
  use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
  use windows::core::PCWSTR;

  let wide: Vec<u16> = to_wide(app_id);
  unsafe {
    if let Err(err) = SetCurrentProcessExplicitAppUserModelID(PCWSTR(wide.as_ptr())) {
      log::warn!("Failed to set AppUserModelID: {err:?}");
    }
  }
}

#[cfg(windows)]
fn register_start_menu_shortcut(app_id: &str) -> windows::core::Result<()> {
  use std::path::PathBuf;

  use windows::Win32::System::Com::{
    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx, IPersistFile,
  };
  use windows::Win32::System::Com::StructuredStorage::PropVariantClear;
  use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
  use windows::Win32::UI::Shell::{
    IShellLinkW, SHCNE_ASSOCCHANGED, SHCNF_IDLIST, SHChangeNotify, ShellLink,
  };
  use windows::core::{Interface, PCWSTR};

  let exe = std::env::current_exe().map_err(|_| windows::core::Error::empty())?;
  let Some(programs) = std::env::var_os("APPDATA").map(|app_data| {
    PathBuf::from(app_data)
      .join("Microsoft")
      .join("Windows")
      .join("Start Menu")
      .join("Programs")
  }) else {
    return Ok(());
  };
  std::fs::create_dir_all(&programs).ok();
  let shortcut_path = programs.join(format!("{}.lnk", crate::DEFAULT_WINDOW_TITLE));

  unsafe {
    let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;

    let exe_wide = to_wide(exe.as_os_str());
    shell_link.SetPath(PCWSTR(exe_wide.as_ptr()))?;
    shell_link.SetIconLocation(PCWSTR(exe_wide.as_ptr()), 0)?;

    let bundled_icon = concat!(env!("CARGO_MANIFEST_DIR"), "\\icons\\icon.ico");
    if std::path::Path::new(bundled_icon).exists() {
      let icon_wide = to_wide(bundled_icon);
      shell_link.SetIconLocation(PCWSTR(icon_wide.as_ptr()), 0)?;
    }

    if let Some(parent) = exe.parent() {
      let dir_wide = to_wide(parent.as_os_str());
      shell_link.SetWorkingDirectory(PCWSTR(dir_wide.as_ptr()))?;
    }

    let description_wide = to_wide(crate::DEFAULT_WINDOW_TITLE);
    shell_link.SetDescription(PCWSTR(description_wide.as_ptr()))?;

    let store: IPropertyStore = shell_link.cast()?;
    let mut app_id_variant = propvariant_lpwstr(app_id)?;
    store.SetValue(&APP_USER_MODEL_ID_KEY, &app_id_variant)?;
    store.Commit()?;
    let _ = PropVariantClear(&mut app_id_variant);

    let persist: IPersistFile = shell_link.cast()?;
    let shortcut_wide = to_wide(shortcut_path.as_os_str());
    persist.Save(PCWSTR(shortcut_wide.as_ptr()), true)?;
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
  }

  Ok(())
}

#[cfg(windows)]
fn propvariant_lpwstr(value: &str) -> windows::core::Result<windows::Win32::System::Com::StructuredStorage::PROPVARIANT> {
  use std::mem::ManuallyDrop;

  use windows::Win32::System::Com::CoTaskMemAlloc;
  use windows::Win32::System::Com::StructuredStorage::{
    PROPVARIANT, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
  };
  use windows::Win32::System::Variant::VT_LPWSTR;
  use windows::core::PWSTR;

  let wide = to_wide(value);
  let bytes = wide.len() * std::mem::size_of::<u16>();
  let ptr = unsafe { CoTaskMemAlloc(bytes) };
  if ptr.is_null() {
    return Err(windows::core::Error::from(
      windows::Win32::Foundation::E_OUTOFMEMORY,
    ));
  }

  unsafe {
    std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr.cast::<u16>(), wide.len());
    let mut variant = PROPVARIANT::default();
    std::ptr::write(
      &mut variant.Anonymous.Anonymous,
      ManuallyDrop::new(PROPVARIANT_0_0 {
        vt: VT_LPWSTR,
        wReserved1: 0,
        wReserved2: 0,
        wReserved3: 0,
        Anonymous: PROPVARIANT_0_0_0 {
          pwszVal: PWSTR(ptr.cast::<u16>()),
        },
      }),
    );
    Ok(variant)
  }
}

#[cfg(windows)]
fn to_wide(value: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
  use std::os::windows::ffi::OsStrExt;
  value
    .as_ref()
    .encode_wide()
    .chain(std::iter::once(0))
    .collect()
}

#[cfg(windows)]
pub fn show_windows_toast(
  app: &AppHandle,
  title: &str,
  body: &str,
  chat_id: Option<String>,
  message_id: Option<i32>,
  is_call: bool,
  theme: &str,
  avatar_data_url: Option<String>,
) -> Result<(), String> {
  if let Ok(mut pending) = PENDING_TOAST.lock() {
    *pending = Some(NotificationClickPayload {
      chat_id: chat_id.clone(),
      message_id,
      is_call,
    });
  }

  if let Err(err) = show_themed_toast_window(
    app,
    title,
    body,
    theme,
    avatar_data_url.as_deref(),
  ) {
    log::warn!("Themed desktop toast failed, using Action Center: {err}");
    return show_action_center_toast(app, title, body, chat_id, message_id, is_call);
  }

  Ok(())
}

#[cfg(windows)]
fn show_themed_toast_window(
  app: &AppHandle,
  title: &str,
  body: &str,
  theme: &str,
  avatar_data_url: Option<&str>,
) -> Result<(), String> {
  use tauri::{LogicalPosition, WebviewUrl};

  let payload = serde_json::json!({
    "title": truncate_chars(title, WINDOWS_TOAST_TITLE_MAX),
    "body": truncate_chars(body, WINDOWS_TOAST_BODY_MAX),
    "theme": if theme == "light" { "light" } else { "dark" },
    "avatarDataUrl": avatar_data_url,
    "appName": crate::DEFAULT_WINDOW_TITLE,
  });
  let payload_js = serde_json::to_string(&payload)
    .map_err(|err| err.to_string())?
    .replace('<', "\\u003c");
  let theme_class = if theme == "light" {
    "theme-light"
  } else {
    "theme-dark"
  };
  let background = if theme == "light" {
    tauri::window::Color(255, 255, 255, 255)
  } else {
    tauri::window::Color(33, 33, 33, 255)
  };

  let (pos_x, pos_y) = toast_position(app);
  let apply_script = format!(
    r#"window.__TOAST__ = {payload_js};
(function () {{
  var themeClass = {theme_class:?};
  var apply = function () {{
    document.documentElement.className = themeClass;
    if (document.body) document.body.className = themeClass;
    if (window.renderToast) window.renderToast();
  }};
  apply();
  document.addEventListener("DOMContentLoaded", apply);
}})();"#
  );

  if let Some(window) = app.get_webview_window(DESKTOP_TOAST_WINDOW_LABEL) {
    let _ = window.set_position(tauri::Position::Logical(LogicalPosition::new(pos_x, pos_y)));
    let _ = window.eval(&apply_script);
    let _ = window.show();
    return Ok(());
  }

  tauri::WebviewWindowBuilder::new(
    app,
    DESKTOP_TOAST_WINDOW_LABEL,
    WebviewUrl::App("desktop-toast.html".into()),
  )
  .title(crate::DEFAULT_WINDOW_TITLE)
  .inner_size(TOAST_WIDTH, TOAST_HEIGHT)
  .position(pos_x, pos_y)
  .decorations(false)
  .resizable(false)
  .maximizable(false)
  .minimizable(false)
  .always_on_top(true)
  .skip_taskbar(true)
  .focused(false)
  .transparent(false)
  .shadow(true)
  .visible(true)
  .background_color(background)
  .initialization_script(&apply_script)
  .build()
  .map_err(|err| err.to_string())?;

  Ok(())
}

#[cfg(windows)]
fn toast_position(app: &AppHandle) -> (f64, f64) {
  let Some(window) = app
    .webview_windows()
    .into_iter()
    .find(|(label, _)| !is_desktop_toast_window(label))
    .map(|(_, window)| window)
  else {
    return (TOAST_MARGIN, TOAST_MARGIN);
  };

  let Ok(Some(monitor)) = window.current_monitor() else {
    return (TOAST_MARGIN, TOAST_MARGIN);
  };

  let scale = monitor.scale_factor();
  let work = monitor.work_area();
  let x = f64::from(work.position.x) / scale
    + f64::from(work.size.width) / scale
    - TOAST_WIDTH
    - TOAST_MARGIN;
  let y = f64::from(work.position.y) / scale
    + f64::from(work.size.height) / scale
    - TOAST_HEIGHT
    - TOAST_MARGIN;
  (x, y)
}

#[cfg(windows)]
fn show_action_center_toast(
  app: &AppHandle,
  title: &str,
  body: &str,
  chat_id: Option<String>,
  message_id: Option<i32>,
  is_call: bool,
) -> Result<(), String> {
  use std::sync::{LazyLock, Mutex};

  use windows::Data::Xml::Dom::XmlDocument;
  use windows::Foundation::TypedEventHandler;
  use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
  use windows::core::{HSTRING, IInspectable};

  static ACTIVE_TOASTS: LazyLock<Mutex<Vec<ToastNotification>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));

  let app_id = app.config().identifier.clone();
  let xml = build_toast_xml(title, body);
  let toast_xml = XmlDocument::new().map_err(|err| err.to_string())?;
  toast_xml
    .LoadXml(&HSTRING::from(xml))
    .map_err(|err| err.to_string())?;

  let toast = ToastNotification::CreateToastNotification(&toast_xml).map_err(|err| err.to_string())?;
  if let Some(ref chat_id) = chat_id {
    let _ = toast.SetGroup(&HSTRING::from(chat_id.as_str()));
    let _ = toast.SetTag(&HSTRING::from(chat_id.as_str()));
  }

  let click_app = app.clone();
  let click_chat_id = chat_id.clone();
  let _ = toast.Activated(&TypedEventHandler::<ToastNotification, IInspectable>::new(
    move |_, _| {
      show_and_focus_any_window(&click_app);
      let _ = click_app.emit(
        NOTIFICATION_CLICKED_EVENT,
        NotificationClickPayload {
          chat_id: click_chat_id.clone(),
          message_id,
          is_call,
        },
      );
      Ok(())
    },
  ));

  ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app_id.as_str()))
    .and_then(|notifier| notifier.Show(&toast))
    .map_err(|err| err.to_string())?;

  if let Ok(mut toasts) = ACTIVE_TOASTS.lock() {
    toasts.push(toast);
    if toasts.len() > 20 {
      toasts.remove(0);
    }
  }

  Ok(())
}

#[cfg(windows)]
fn build_toast_xml(title: &str, body: &str) -> String {
  format!(
    r#"<toast activationType="foreground">
  <visual>
    <binding template="ToastGeneric">
      <text>{}</text>
      <text>{}</text>
    </binding>
  </visual>
  <audio silent="true"/>
</toast>"#,
    escape_xml(&truncate_chars(title, WINDOWS_TOAST_TITLE_MAX)),
    escape_xml(&truncate_chars(body, WINDOWS_TOAST_BODY_MAX)),
  )
}

#[cfg(windows)]
fn truncate_chars(value: &str, max_chars: usize) -> String {
  let mut result = String::new();
  for (index, ch) in value.chars().enumerate() {
    if index >= max_chars {
      result.push('…');
      break;
    }
    result.push(ch);
  }
  result
}

#[cfg(windows)]
fn escape_xml(value: &str) -> String {
  value
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
    .replace('\'', "&apos;")
}

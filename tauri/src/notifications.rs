use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[cfg_attr(not(windows), allow(dead_code))]
pub const NOTIFICATION_CLICKED_EVENT: &str = "notification-clicked";
pub const DESKTOP_TOAST_WINDOW_LABEL: &str = "desktop-toast";

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

  crate::reveal_app_window(app, window);
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
  #[cfg(windows)]
  destroy_monitor_toast();
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
    log::warn!("Failed to register JVgram toast identity: {err:?}");
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
  _avatar_data_url: Option<String>,
  account_name: Option<String>,
) -> Result<(), String> {
  close_desktop_toast(app);

  if let Ok(mut pending) = PENDING_TOAST.lock() {
    *pending = Some(NotificationClickPayload {
      chat_id: chat_id.clone(),
      message_id,
      is_call,
    });
  }

  if let Err(err) = show_monitor_toast(app, title, body, theme, is_call, account_name.as_deref()) {
    log::warn!("Monitor toast failed, falling back to Action Center: {err}");
    show_action_center_toast(app, title, body, chat_id, message_id, is_call, account_name.as_deref())
  } else {
    Ok(())
  }
}

#[cfg(windows)]
const MONITOR_TOAST_CLASS: &str = "JVgramMonitorToast";
#[cfg(windows)]
const MONITOR_TOAST_WIDTH: i32 = 360;
#[cfg(windows)]
const MONITOR_TOAST_HEIGHT: i32 = 108;
#[cfg(windows)]
const MONITOR_TOAST_MARGIN: i32 = 16;
#[cfg(windows)]
const MONITOR_TOAST_TIMER_ID: usize = 1;
#[cfg(windows)]
const MONITOR_TOAST_DURATION_MS: u32 = 6000;
#[cfg(windows)]
const MONITOR_TOAST_CALL_DURATION_MS: u32 = 10000;

#[cfg(windows)]
#[derive(Clone)]
struct MonitorToastUi {
  hwnd: isize,
  title: String,
  body: String,
  account: String,
  is_dark: bool,
  scale: f64,
}

#[cfg(windows)]
static MONITOR_TOAST_UI: std::sync::Mutex<Option<MonitorToastUi>> = std::sync::Mutex::new(None);
#[cfg(windows)]
static MONITOR_TOAST_APP: std::sync::Mutex<Option<AppHandle>> = std::sync::Mutex::new(None);

#[cfg(windows)]
fn main_app_window(app: &AppHandle) -> Option<tauri::Window> {
  let mut windows: Vec<_> = app
    .windows()
    .into_iter()
    .filter(|(label, _)| !is_desktop_toast_window(label))
    .map(|(_, window)| window)
    .collect();

  windows.sort_by_key(|window| {
    let focused = window.is_focused().unwrap_or(false);
    let visible = window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false);
    (!focused, !visible)
  });
  windows.into_iter().next()
}

#[cfg(windows)]
fn scale_px(logical: i32, scale: f64) -> i32 {
  (logical as f64 * scale).round().max(1.0) as i32
}

#[cfg(windows)]
fn show_monitor_toast(
  app: &AppHandle,
  title: &str,
  body: &str,
  theme: &str,
  is_call: bool,
  account_name: Option<&str>,
) -> Result<(), String> {
  use windows::Win32::Graphics::Dwm::{
    DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUNDSMALL, DwmSetWindowAttribute,
  };
  use windows::Win32::UI::WindowsAndMessaging::{
    HWND_TOPMOST, SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_SHOWNOACTIVATE, SetTimer, SetWindowPos,
    ShowWindow,
  };

  let window = main_app_window(app).ok_or("No app window")?;
  let monitor = window
    .current_monitor()
    .ok()
    .flatten()
    .or_else(|| {
      window.outer_position().ok().and_then(|position| {
        window
          .monitor_from_point(f64::from(position.x), f64::from(position.y))
          .ok()
          .flatten()
      })
    })
    .or_else(|| window.primary_monitor().ok().flatten())
    .ok_or("No monitor")?;

  let work = monitor.work_area();
  let scale = monitor.scale_factor().max(1.0);
  let width = scale_px(MONITOR_TOAST_WIDTH, scale);
  let height = scale_px(MONITOR_TOAST_HEIGHT, scale);
  let margin = scale_px(MONITOR_TOAST_MARGIN, scale);
  let work_right = work.position.x.saturating_add_unsigned(work.size.width);
  let x = (work_right - width - margin).max(work.position.x + margin);
  let y = work.position.y + margin;

  if let Ok(mut stored) = MONITOR_TOAST_APP.lock() {
    *stored = Some(app.clone());
  }

  let title = truncate_chars(title, WINDOWS_TOAST_TITLE_MAX);
  let title = if title.trim().is_empty() {
    crate::DEFAULT_WINDOW_TITLE.to_string()
  } else {
    title
  };
  let body = truncate_chars(body, WINDOWS_TOAST_BODY_MAX);
  let account = account_name
    .map(|name| truncate_chars(name, WINDOWS_TOAST_TITLE_MAX))
    .filter(|name| !name.trim().is_empty())
    .unwrap_or_default();
  let is_dark = theme != "light";
  let duration = if is_call {
    MONITOR_TOAST_CALL_DURATION_MS
  } else {
    MONITOR_TOAST_DURATION_MS
  };

  let hwnd = if let Some(existing) = current_monitor_toast_hwnd() {
    existing
  } else {
    create_monitor_toast_window(width, height)?
  };

  unsafe {
    let _ = SetWindowPos(
      hwnd,
      Some(HWND_TOPMOST),
      x,
      y,
      width,
      height,
      SWP_NOACTIVATE | SWP_SHOWWINDOW,
    );
    let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    let corner = DWMWCP_ROUNDSMALL;
    let _ = DwmSetWindowAttribute(
      hwnd,
      DWMWA_WINDOW_CORNER_PREFERENCE,
      std::ptr::from_ref(&corner).cast(),
      std::mem::size_of_val(&corner) as u32,
    );
    let _ = SetTimer(Some(hwnd), MONITOR_TOAST_TIMER_ID, duration, None);
  }

  if let Ok(mut ui) = MONITOR_TOAST_UI.lock() {
    *ui = Some(MonitorToastUi {
      hwnd: hwnd.0 as isize,
      title,
      body,
      account,
      is_dark,
      scale,
    });
  }

  unsafe {
    let _ = windows::Win32::Graphics::Gdi::InvalidateRect(Some(hwnd), None, true);
  }

  Ok(())
}

#[cfg(windows)]
fn current_monitor_toast_hwnd() -> Option<windows::Win32::Foundation::HWND> {
  use windows::Win32::Foundation::HWND;
  use windows::Win32::UI::WindowsAndMessaging::IsWindow;

  let hwnd_value = MONITOR_TOAST_UI.lock().ok()?.as_ref()?.hwnd;
  let hwnd = HWND(hwnd_value as *mut std::ffi::c_void);
  unsafe {
    if IsWindow(Some(hwnd)).as_bool() {
      Some(hwnd)
    } else {
      None
    }
  }
}

#[cfg(windows)]
fn destroy_monitor_toast() {
  use windows::Win32::Foundation::HWND;
  use windows::Win32::UI::WindowsAndMessaging::{DestroyWindow, IsWindow, KillTimer};

  let hwnd_value = MONITOR_TOAST_UI.lock().ok().and_then(|mut ui| ui.take().map(|toast| toast.hwnd));
  if let Some(hwnd_value) = hwnd_value {
    let hwnd = HWND(hwnd_value as *mut std::ffi::c_void);
    unsafe {
      if IsWindow(Some(hwnd)).as_bool() {
        let _ = KillTimer(Some(hwnd), MONITOR_TOAST_TIMER_ID);
        let _ = DestroyWindow(hwnd);
      }
    }
  }
}

#[cfg(windows)]
fn create_monitor_toast_window(width: i32, height: i32) -> Result<windows::Win32::Foundation::HWND, String> {
  use std::sync::Once;

  use windows::Win32::Foundation::HINSTANCE;
  use windows::Win32::System::LibraryLoader::GetModuleHandleW;
  use windows::Win32::UI::WindowsAndMessaging::{
    CS_DROPSHADOW, CS_HREDRAW, CS_VREDRAW, CreateWindowExW, IDC_HAND, LoadCursorW, RegisterClassExW,
    WNDCLASSEXW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
  };
  use windows::core::PCWSTR;

  static REGISTER_CLASS: Once = Once::new();
  let class_name = to_wide(MONITOR_TOAST_CLASS);
  REGISTER_CLASS.call_once(|| {
    let instance = unsafe { GetModuleHandleW(PCWSTR::null()) }.ok();
    let cursor = unsafe { LoadCursorW(None, IDC_HAND) }.unwrap_or_default();
    let class = WNDCLASSEXW {
      cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
      style: CS_HREDRAW | CS_VREDRAW | CS_DROPSHADOW,
      lpfnWndProc: Some(monitor_toast_wnd_proc),
      hInstance: instance.map(HINSTANCE::from).unwrap_or_default(),
      hCursor: cursor,
      lpszClassName: PCWSTR(class_name.as_ptr()),
      ..Default::default()
    };
    unsafe {
      RegisterClassExW(&class);
    }
  });

  let instance = unsafe { GetModuleHandleW(PCWSTR::null()) }.map_err(|err| err.to_string())?;
  unsafe {
    CreateWindowExW(
      WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
      PCWSTR(class_name.as_ptr()),
      PCWSTR::null(),
      WS_POPUP,
      0,
      0,
      width,
      height,
      None,
      None,
      Some(HINSTANCE::from(instance)),
      None,
    )
    .map_err(|err| err.to_string())
  }
}

#[cfg(windows)]
unsafe extern "system" fn monitor_toast_wnd_proc(
  hwnd: windows::Win32::Foundation::HWND,
  msg: u32,
  wparam: windows::Win32::Foundation::WPARAM,
  lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
  use windows::Win32::Foundation::LRESULT;
  use windows::Win32::UI::WindowsAndMessaging::{
    DefWindowProcW, WM_DESTROY, WM_ERASEBKGND, WM_LBUTTONUP, WM_PAINT, WM_TIMER,
  };

  match msg {
    WM_ERASEBKGND => LRESULT(1),
    WM_PAINT => {
      paint_monitor_toast(hwnd);
      LRESULT(0)
    }
    WM_LBUTTONUP => {
      if let Ok(guard) = MONITOR_TOAST_APP.lock() {
        if let Some(app) = guard.as_ref() {
          activate_desktop_toast(app);
        }
      }
      LRESULT(0)
    }
    WM_TIMER => {
      destroy_monitor_toast();
      LRESULT(0)
    }
    WM_DESTROY => {
      if let Ok(mut ui) = MONITOR_TOAST_UI.lock() {
        if ui.as_ref().is_some_and(|toast| toast.hwnd == hwnd.0 as isize) {
          *ui = None;
        }
      }
      LRESULT(0)
    }
    _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
  }
}

#[cfg(windows)]
fn paint_monitor_toast(hwnd: windows::Win32::Foundation::HWND) {
  use windows::Win32::Foundation::{COLORREF, RECT};
  use windows::Win32::Graphics::Gdi::{
    BeginPaint, CLEARTYPE_QUALITY, CreateFontW, CreateSolidBrush, DEFAULT_CHARSET, DT_END_ELLIPSIS,
    DT_LEFT, DT_NOPREFIX, DT_SINGLELINE, DT_TOP, DT_WORDBREAK, DeleteObject, DrawTextW, EndPaint,
    FillRect, PAINTSTRUCT, SelectObject, SetBkMode, SetTextColor, TRANSPARENT,
  };
  use windows::Win32::UI::WindowsAndMessaging::GetClientRect;
  use windows::core::w;

  let ui = MONITOR_TOAST_UI.lock().ok().and_then(|guard| guard.clone());
  let Some(ui) = ui else {
    return;
  };

  let mut paint = PAINTSTRUCT::default();
  let hdc = unsafe { BeginPaint(hwnd, &mut paint) };
  if hdc.0.is_null() {
    return;
  }

  let mut client = RECT::default();
  let _ = unsafe { GetClientRect(hwnd, &mut client) };

  let (bg, title_color, body_color, account_color, accent) = if ui.is_dark {
    (
      COLORREF(0x00_1F_1F_1F),
      COLORREF(0x00_FF_FF_FF),
      COLORREF(0x00_C8_C8_C8),
      COLORREF(0x00_EC_90_33),
      COLORREF(0x00_EC_90_33),
    )
  } else {
    (
      COLORREF(0x00_FF_FF_FF),
      COLORREF(0x00_11_11_11),
      COLORREF(0x00_5A_5A_5A),
      COLORREF(0x00_EC_90_33),
      COLORREF(0x00_EC_90_33),
    )
  };

  unsafe {
    let background = CreateSolidBrush(bg);
    FillRect(hdc, &client, background);
    let _ = DeleteObject(background.into());

    let accent_width = scale_px(4, ui.scale);
    let mut accent_rect = client;
    accent_rect.right = accent_rect.left + accent_width;
    let accent_brush = CreateSolidBrush(accent);
    FillRect(hdc, &accent_rect, accent_brush);
    let _ = DeleteObject(accent_brush.into());

    SetBkMode(hdc, TRANSPARENT);
    let pad = scale_px(16, ui.scale);
    let has_account = !ui.account.trim().is_empty();
    let mut title_rect = RECT {
      left: client.left + pad + accent_width,
      top: client.top + scale_px(10, ui.scale),
      right: client.right - pad,
      bottom: client.top + scale_px(34, ui.scale),
    };
    let mut body_rect = RECT {
      left: title_rect.left,
      top: title_rect.bottom,
      right: title_rect.right,
      bottom: if has_account {
        client.bottom - scale_px(28, ui.scale)
      } else {
        client.bottom - scale_px(12, ui.scale)
      },
    };

    let title_font = CreateFontW(
      -scale_px(15, ui.scale),
      0,
      0,
      0,
      600,
      0,
      0,
      0,
      DEFAULT_CHARSET,
      Default::default(),
      Default::default(),
      CLEARTYPE_QUALITY,
      0,
      w!("Segoe UI"),
    );
    let body_font = CreateFontW(
      -scale_px(13, ui.scale),
      0,
      0,
      0,
      400,
      0,
      0,
      0,
      DEFAULT_CHARSET,
      Default::default(),
      Default::default(),
      CLEARTYPE_QUALITY,
      0,
      w!("Segoe UI"),
    );

    SetTextColor(hdc, title_color);
    let old_font = SelectObject(hdc, title_font.into());
    let mut title = ui.title.encode_utf16().collect::<Vec<u16>>();
    DrawTextW(
      hdc,
      &mut title,
      &mut title_rect,
      DT_LEFT | DT_TOP | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX,
    );

    SetTextColor(hdc, body_color);
    SelectObject(hdc, body_font.into());
    let mut body = ui.body.encode_utf16().collect::<Vec<u16>>();
    DrawTextW(
      hdc,
      &mut body,
      &mut body_rect,
      DT_LEFT | DT_TOP | DT_WORDBREAK | DT_END_ELLIPSIS | DT_NOPREFIX,
    );

    let account_font = if has_account {
      let font = CreateFontW(
        -scale_px(12, ui.scale),
        0,
        0,
        0,
        600,
        0,
        0,
        0,
        DEFAULT_CHARSET,
        Default::default(),
        Default::default(),
        CLEARTYPE_QUALITY,
        0,
        w!("Segoe UI"),
      );
      let mut account_rect = RECT {
        left: title_rect.left,
        top: client.bottom - scale_px(26, ui.scale),
        right: title_rect.right,
        bottom: client.bottom - scale_px(8, ui.scale),
      };
      SetTextColor(hdc, account_color);
      SelectObject(hdc, font.into());
      let mut account = ui.account.encode_utf16().collect::<Vec<u16>>();
      DrawTextW(
        hdc,
        &mut account,
        &mut account_rect,
        DT_LEFT | DT_TOP | DT_SINGLELINE | DT_END_ELLIPSIS | DT_NOPREFIX,
      );
      Some(font)
    } else {
      None
    };

    SelectObject(hdc, old_font);
    let _ = DeleteObject(title_font.into());
    let _ = DeleteObject(body_font.into());
    if let Some(font) = account_font {
      let _ = DeleteObject(font.into());
    }
    let _ = EndPaint(hwnd, &paint);
  }
}

#[cfg(windows)]
fn show_action_center_toast(
  app: &AppHandle,
  title: &str,
  body: &str,
  chat_id: Option<String>,
  message_id: Option<i32>,
  is_call: bool,
  account_name: Option<&str>,
) -> Result<(), String> {
  use std::sync::{LazyLock, Mutex};

  use windows::Data::Xml::Dom::XmlDocument;
  use windows::Foundation::TypedEventHandler;
  use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
  use windows::core::{HSTRING, IInspectable};

  static ACTIVE_TOASTS: LazyLock<Mutex<Vec<ToastNotification>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));

  let app_id = app.config().identifier.clone();
  let xml = build_toast_xml(title, body, account_name);
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
fn build_toast_xml(title: &str, body: &str, account_name: Option<&str>) -> String {
  let title = truncate_chars(title, WINDOWS_TOAST_TITLE_MAX);
  let title = if title.trim().is_empty() {
    crate::DEFAULT_WINDOW_TITLE.to_string()
  } else {
    title
  };
  let body = truncate_chars(body, WINDOWS_TOAST_BODY_MAX);
  let attribution = account_name
    .map(str::trim)
    .filter(|name| !name.is_empty())
    .map(|name| format!("{} · {}", name, crate::DEFAULT_WINDOW_TITLE))
    .unwrap_or_else(|| crate::DEFAULT_WINDOW_TITLE.to_string());

  format!(
    r#"<toast activationType="foreground" duration="long">
  <visual>
    <binding template="ToastGeneric">
      <text>{}</text>
      <text>{}</text>
      <text placement="attribution">{}</text>
    </binding>
  </visual>
  <audio silent="true"/>
</toast>"#,
    escape_xml(&title),
    escape_xml(&body),
    escape_xml(&attribution),
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

fn main() {
  tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
    tauri_build::AppManifest::new().commands(&[
      "mark_title_bar_overlay",
      "set_notifications_count",
      "set_window_title",
      "open_new_window_cmd",
      "save_current_url",
      "set_menu_translations",
      "show_desktop_notification",
      "is_app_window_active",
      "activate_desktop_toast",
      "close_desktop_toast",
      "check_github_update",
      "install_github_update",
    ]),
  ))
  .expect("Failed to build Tauri application")
}

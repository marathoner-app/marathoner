locals {
  project_id        = "marathoner-d9bf9"
  caller_account_id = "creator-radar-events-dev"
  caller_email      = "${local.caller_account_id}@${local.project_id}.iam.gserviceaccount.com"
}

resource "google_service_account" "creator_radar_events_development" {
  provider = google-beta

  project      = local.project_id
  account_id   = local.caller_account_id
  display_name = "Creator Radar events development caller"
  description  = "Keyless Marathoner backend identity for the private Creator Radar development event endpoint."
}

check "development_identity_is_exact" {
  assert {
    condition     = local.caller_email == "creator-radar-events-dev@marathoner-d9bf9.iam.gserviceaccount.com"
    error_message = "The issue #102 caller identity is fixed and development-only."
  }
}

output "caller_service_account_email" {
  description = "The exact development caller identity."
  value       = google_service_account.creator_radar_events_development.email
}

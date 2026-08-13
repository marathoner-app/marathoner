terraform {
  required_version = "~> 1.15.0"

  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.40.0"
    }
  }

  backend "gcs" {}
}

provider "google-beta" {
  project               = local.project_id
  billing_project       = local.project_id
  user_project_override = true
}

locals {
  env         = lower(var.environment)

  name_prefix = lower(var.name_prefix)
  name_suffix = lower(var.name_suffix)
  name_base   = trim(join("-", compact([local.name_prefix, local.env, local.name_suffix])), "-")

  common_tags = merge(
    {
      environment = local.env
      managed_by  = "terraform"
      project     = "chat-app"
    },
    var.tags
  )

  storage_account_base = lower(replace("st${var.storage_account_name_prefix}${local.env}${random_string.suffix.result}", "-", ""))
  storage_account_name = substr(local.storage_account_base, 0, 24)

  key_vault_name_base = lower(replace("kv-${local.name_base}-${random_string.suffix.result}", "_", "-"))
  key_vault_name      = substr(local.key_vault_name_base, 0, 24)
}

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "azurerm_resource_group" "foundation" {
  name     = "rg-${local.name_base}"
  location = var.location
  tags     = local.common_tags
}

data "azurerm_client_config" "current" {}

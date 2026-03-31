resource "azurerm_storage_account" "foundation" {
  name                            = local.storage_account_name
  resource_group_name             = azurerm_resource_group.foundation.name
  location                        = azurerm_resource_group.foundation.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = local.common_tags
}

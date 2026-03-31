resource "azurerm_key_vault" "foundation" {
  name                          = local.key_vault_name
  location                      = azurerm_resource_group.foundation.location
  resource_group_name           = azurerm_resource_group.foundation.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  purge_protection_enabled      = true
  soft_delete_retention_days    = 7
  public_network_access_enabled = false
  tags                          = local.common_tags
}

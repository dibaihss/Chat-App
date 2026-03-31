resource "azurerm_log_analytics_workspace" "foundation" {
  name                = "log-${local.name_base}"
  location            = azurerm_resource_group.foundation.location
  resource_group_name = azurerm_resource_group.foundation.name
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days
  tags                = local.common_tags
}

resource "azurerm_application_insights" "foundation" {
  name                = "appi-${local.name_base}"
  location            = azurerm_resource_group.foundation.location
  resource_group_name = azurerm_resource_group.foundation.name
  workspace_id        = azurerm_log_analytics_workspace.foundation.id
  application_type    = "web"
  tags                = local.common_tags
}

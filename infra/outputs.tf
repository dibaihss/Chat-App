output "resource_group_name" {
  description = "Foundation resource group name."
  value       = azurerm_resource_group.foundation.name
}

output "location" {
  description = "Azure region for deployed foundation resources."
  value       = azurerm_resource_group.foundation.location
}

output "vnet_id" {
  description = "Virtual network ID."
  value       = azurerm_virtual_network.foundation.id
}

output "subnet_ids" {
  description = "Subnet IDs for future runtime and private endpoint integration."
  value = {
    appgw              = azurerm_subnet.appgw.id
    appsvc_integration = azurerm_subnet.appsvc_integration.id
    private_endpoints  = azurerm_subnet.private_endpoints.id
  }
}

output "key_vault_name" {
  description = "Key Vault name."
  value       = azurerm_key_vault.foundation.name
}

output "key_vault_uri" {
  description = "Key Vault URI for application configuration."
  value       = azurerm_key_vault.foundation.vault_uri
}

output "application_insights_connection_string" {
  description = "Application Insights connection string."
  value       = azurerm_application_insights.foundation.connection_string
  sensitive   = true
}

output "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key."
  value       = azurerm_application_insights.foundation.instrumentation_key
  sensitive   = true
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace resource ID."
  value       = azurerm_log_analytics_workspace.foundation.id
}

output "storage_account_name" {
  description = "Storage account name."
  value       = azurerm_storage_account.foundation.name
}
